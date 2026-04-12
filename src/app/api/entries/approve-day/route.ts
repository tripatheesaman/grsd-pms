import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { recalculateEquipmentUsageBatch } from "@/lib/planning/recalculate-usage";
import { getSystemThresholds } from "@/lib/planning/thresholds";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { minimumReadingFromContext } from "@/lib/entries/reading-floor";
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
      meterSegment: true,
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
  const [allApprovedBeforeLatestPending, approvedCounts, equipmentHoursRows] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
        entryDate: { lt: maxEntryDate },
      },
      select: {
        equipmentId: true,
        meterSegment: true,
        entryDate: true,
        hoursRun: true,
      },
      orderBy: [{ equipmentId: "asc" }, { meterSegment: "asc" }, { entryDate: "asc" }],
    }),
    prisma.dailyEntry.groupBy({
      by: ["equipmentId"],
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
      },
      _count: true,
    }),
    prisma.equipment.findMany({
      where: { id: { in: equipmentIds } },
      select: { id: true, currentHours: true },
    }),
  ]);

  const approvedByKey = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const row of allApprovedBeforeLatestPending) {
    const k = `${row.equipmentId}:${row.meterSegment}`;
    const list = approvedByKey.get(k) ?? [];
    list.push({ entryDate: row.entryDate, hoursRun: Number(row.hoursRun) });
    approvedByKey.set(k, list);
  }

  const hasAnyApprovedMap = new Map(
    approvedCounts.map((c) => [c.equipmentId, c._count > 0]),
  );
  const currentHoursByEquipment = new Map(
    equipmentHoursRows.map((e) => [e.id, Number(e.currentHours)]),
  );

  const validEntries = pendingEntries.filter((entry) => {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const segmentRows = approvedByKey.get(k) ?? [];
    const minReading = minimumReadingFromContext(
      segmentRows,
      entry.entryDate,
      hasAnyApprovedMap.get(entry.equipmentId) ?? false,
      currentHoursByEquipment.get(entry.equipmentId) ?? 0,
    );

    const hoursRun = Number(entry.hoursRun);
    if (!Number.isFinite(hoursRun) || hoursRun <= 0 || hoursRun > MAX_HOURS_RUN) {
      return false;
    }
    return hoursRun >= minReading;
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
