import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import {
  findPreviousApprovedReading,
  minimumReadingFromContext,
} from "@/lib/entries/reading-floor";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const pendingEntries = await prisma.dailyEntry.findMany({
    where: {
      status: EntryStatus.PENDING,
    },
    include: {
      equipment: {
        select: {
          id: true,
          equipmentNumber: true,
          displayName: true,
          currentHours: true,
          usageUnit: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (pendingEntries.length === 0) {
    return ok([]);
  }

  const equipmentIds = [...new Set(pendingEntries.map((e) => e.equipmentId))];
  const maxPendingEntryDate = new Date(
    Math.max(...pendingEntries.map((entry) => entry.entryDate.getTime())),
  );

  const [allApprovedEntries, approvedCounts] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
        entryDate: { lt: maxPendingEntryDate },
      },
      select: {
        equipmentId: true,
        meterSegment: true,
        entryDate: true,
        hoursRun: true,
      },
      orderBy: [
        { equipmentId: "asc" },
        { meterSegment: "asc" },
        { entryDate: "asc" },
      ],
    }),
    prisma.dailyEntry.groupBy({
      by: ["equipmentId"],
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
      },
      _count: true,
    }),
  ]);

  const approvedByKey = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const entry of allApprovedEntries) {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const rows = approvedByKey.get(k) ?? [];
    rows.push({ entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) });
    approvedByKey.set(k, rows);
  }

  const approvedCountMap = new Map(
    approvedCounts.map((c) => [c.equipmentId, c._count > 0]),
  );

  const currentHoursByEquipment = new Map<string, number>();
  for (const e of pendingEntries) {
    if (!currentHoursByEquipment.has(e.equipmentId)) {
      currentHoursByEquipment.set(e.equipmentId, Number(e.equipment.currentHours));
    }
  }

  const entriesWithPrevious = pendingEntries.map((entry) => {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const segmentRows = approvedByKey.get(k) ?? [];
    const previousHours = minimumReadingFromContext(
      segmentRows,
      entry.entryDate,
      approvedCountMap.get(entry.equipmentId) ?? false,
      currentHoursByEquipment.get(entry.equipmentId) ?? 0,
    );

    const previousEntry = findPreviousApprovedReading(segmentRows, entry.entryDate);

    return {
      id: entry.id,
      equipmentId: entry.equipmentId,
      equipmentNumber: entry.equipment.equipmentNumber,
      equipmentName: entry.equipment.displayName,
      usageUnit: entry.equipment.usageUnit,
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
      status: entry.status,
      createdBy: entry.createdBy.fullName,
      createdByEmail: entry.createdBy.email,
      createdAt: entry.createdAt.toISOString(),
      previousEntryDate: previousEntry?.entryDate.toISOString() || null,
      previousHours,
      currentEquipmentHours: Number(entry.equipment.currentHours),
    };
  });

  return ok(entriesWithPrevious);
}
