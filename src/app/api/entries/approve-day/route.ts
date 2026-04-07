import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { recalculateEquipmentUsageBatch } from "@/lib/planning/recalculate-usage";
import { getSystemThresholds } from "@/lib/planning/thresholds";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const MAX_HOURS_RUN = 1_000_000;

const approveDaySchema = z.object({
  entryDate: z.string().date(),
});

/** Plan sync is CPU/DB heavy; keep in-flight work moderate to avoid DB pool thrash. */
const PLAN_SYNC_CONCURRENCY = 12;

async function runInConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index++];
      await fn(current);
    }
  });
  await Promise.all(workers);
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, approveDaySchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const day = new Date(parsed.data.entryDate);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(day.getDate() + 1);

  const pendingEntries = await prisma.dailyEntry.findMany({
    where: {
      status: EntryStatus.PENDING,
      entryDate: {
        gte: day,
        lt: nextDay,
      },
    },
    select: {
      id: true,
      equipmentId: true,
      entryDate: true,
      hoursRun: true,
    },
    orderBy: {
      entryDate: "asc",
    },
  });

  if (pendingEntries.length === 0) {
    return fail("NOT_FOUND", "No pending entries found for this date", 404);
  }

  const equipmentIds = [...new Set(pendingEntries.map((e) => e.equipmentId))];
  const maxEntryDate = new Date(Math.max(...pendingEntries.map((e) => e.entryDate.getTime())));

  /**
   * @@unique([equipmentId, entryDate, status]) allows BOTH (E, T, APPROVED) and (E, T, PENDING).
   * Bulk/single entry create only blocks duplicate PENDING, so users can end up with a new PENDING
   * when an APPROVED row already exists for the same stored `entryDate`. Promoting PENDING → APPROVED
   * would then create a second APPROVED with the same (E, T) and violate the unique key.
   * We delete conflicting APPROVED rows first so the pending submission becomes the approved record.
   */
  const allApprovedBeforeLatestPending = await prisma.dailyEntry.findMany({
    where: {
      equipmentId: { in: equipmentIds },
      status: EntryStatus.APPROVED,
      entryDate: { lt: maxEntryDate },
    },
    select: {
      equipmentId: true,
      entryDate: true,
      hoursRun: true,
    },
    orderBy: [{ equipmentId: "asc" }, { entryDate: "asc" }],
  });

  /** Approved rows for this equipment, sorted by entryDate ascending (for "previous" lookup). */
  const approvedByEquipment = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const row of allApprovedBeforeLatestPending) {
    const list = approvedByEquipment.get(row.equipmentId) ?? [];
    list.push({ entryDate: row.entryDate, hoursRun: Number(row.hoursRun) });
    approvedByEquipment.set(row.equipmentId, list);
  }

  /** Latest APPROVED strictly before this pending row's `entryDate` (same rule as single-entry approve). */
  function previousApprovedHoursFor(equipmentId: string, before: Date): number {
    const list = approvedByEquipment.get(equipmentId) ?? [];
    let prevHours = 0;
    for (const a of list) {
      if (a.entryDate.getTime() >= before.getTime()) break;
      prevHours = a.hoursRun;
    }
    return prevHours;
  }

  const validEntries = pendingEntries.filter((entry) => {
    const previousHours = previousApprovedHoursFor(entry.equipmentId, entry.entryDate);

    const hoursRun = Number(entry.hoursRun);
    if (!Number.isFinite(hoursRun) || hoursRun <= 0 || hoursRun > MAX_HOURS_RUN) {
      return false;
    }
    return hoursRun >= previousHours;
  });

  const invalidCount = pendingEntries.length - validEntries.length;

  const idsToApprove = validEntries.map((e) => e.id);
  const approvedAt = new Date();
  const currentYear = new Date().getFullYear();

  if (idsToApprove.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.dailyEntry.deleteMany({
        where: {
          status: EntryStatus.APPROVED,
          OR: validEntries.map((e) => ({
            equipmentId: e.equipmentId,
            entryDate: e.entryDate,
          })),
        },
      });

      await tx.dailyEntry.updateMany({
        where: { id: { in: idsToApprove } },
        data: {
          status: EntryStatus.APPROVED,
          approvedById: access.user.id,
          approvedAt,
        },
      });
    });
  }

  const uniqueEquipmentIds = [...new Set(validEntries.map((e) => e.equipmentId))];

  if (uniqueEquipmentIds.length > 0) {
    // Warm threshold cache once so parallel syncs do not each hit systemConfig.
    await getSystemThresholds();
    // One batched pass for averages/current hours (few queries), then parallel plan sync only.
    await recalculateEquipmentUsageBatch(uniqueEquipmentIds);
    await runInConcurrencyLimit(uniqueEquipmentIds, PLAN_SYNC_CONCURRENCY, async (equipmentId) => {
      await syncEquipmentPlan(equipmentId, currentYear);
    });
  }

  writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.approve.batch",
    entityType: "DailyEntry",
    entityId: null,
    payload: {
      batchDate: day.toISOString(),
      approvedCount: idsToApprove.length,
      invalidCount,
    },
    request,
  }).catch(() => null);

  return ok({
    approvedCount: idsToApprove.length,
    invalidCount,
    date: day.toISOString(),
  });
}
