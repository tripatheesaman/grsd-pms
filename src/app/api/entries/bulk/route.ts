import { EntryStatus } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { minimumReadingForDailyEntry } from "@/lib/entries/reading-floor";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const MAX_HOURS_RUN = 1_000_000;

const bulkSchema = z.object({
  entryDate: z.string().date(),
  items: z
    .array(
      z.object({
        equipmentId: z.string().min(1),
        hoursRun: z.number(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.entryCreate,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, bulkSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const day = new Date(parsed.data.entryDate);
  day.setHours(0, 0, 0, 0);

  const equipmentIds = Array.from(new Set(parsed.data.items.map((item) => item.equipmentId)));

  const [equipments, existingEntries] = await Promise.all([
    prisma.equipment.findMany({
      where: {
        id: {
          in: equipmentIds,
        },
      },
      select: {
        id: true,
        currentHours: true,
        meterSegment: true,
      },
    }),
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: {
          in: equipmentIds,
        },
        entryDate: day,
        status: EntryStatus.PENDING,
      },
      select: {
        equipmentId: true,
      },
    }),
  ]);

  const equipmentMap = new Map(equipments.map((e) => [e.id, e]));
  const pendingSet = new Set(existingEntries.map((e) => e.equipmentId));

  const toCreate: Array<{
    equipmentId: string;
    entryDate: Date;
    meterSegment: number;
    hoursRun: number;
    status: EntryStatus;
    createdById: string;
  }> = [];

  const failures: Array<{ equipmentId: string; message: string }> = [];

  for (const item of parsed.data.items) {
    const equipment = equipmentMap.get(item.equipmentId);
    if (!equipment) {
      failures.push({ equipmentId: item.equipmentId, message: "Equipment not found" });
      continue;
    }

    if (pendingSet.has(item.equipmentId)) {
      failures.push({ equipmentId: item.equipmentId, message: "Pending entry already exists for this day" });
      continue;
    }

    if (!Number.isFinite(item.hoursRun) || item.hoursRun <= 0 || item.hoursRun > MAX_HOURS_RUN) {
      failures.push({ equipmentId: item.equipmentId, message: "Invalid hours value" });
      continue;
    }

    const minReading = await minimumReadingForDailyEntry(prisma, {
      equipmentId: item.equipmentId,
      meterSegment: equipment.meterSegment,
      beforeEntryDate: day,
      equipmentCurrentHours: Number(equipment.currentHours),
    });
    if (item.hoursRun < minReading) {
      failures.push({
        equipmentId: item.equipmentId,
        message: `Hours must be at least ${minReading.toFixed(2)}`,
      });
      continue;
    }

    toCreate.push({
      equipmentId: item.equipmentId,
      entryDate: day,
      meterSegment: equipment.meterSegment,
      hoursRun: item.hoursRun,
      status: EntryStatus.PENDING,
      createdById: access.user.id,
    });
  }

  if (toCreate.length === 0) {
    return ok({
      createdCount: 0,
      failed: failures,
    });
  }

  await prisma.dailyEntry.createMany({
    data: toCreate,
    skipDuplicates: true,
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.create.bulk",
    entityType: "DailyEntry",
    entityId: null,
    payload: {
      entryDate: day.toISOString(),
      createdCount: toCreate.length,
      failed: failures,
    },
    request,
  }).catch(() => null);

  return ok({
    createdCount: toCreate.length,
    failed: failures,
  });
}
