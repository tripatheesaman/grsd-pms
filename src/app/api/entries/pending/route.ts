import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type ApprovedEntryRow = {
  entryDate: Date;
  hoursRun: number;
};

function findPreviousApprovedEntry(
  approvedRows: ApprovedEntryRow[],
  currentEntryDate: Date,
): ApprovedEntryRow | null {
  let left = 0;
  let right = approvedRows.length - 1;
  let resultIndex = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midMs = approvedRows[mid]!.entryDate.getTime();
    if (midMs < currentEntryDate.getTime()) {
      resultIndex = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return resultIndex >= 0 ? approvedRows[resultIndex]! : null;
}

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
        entryDate: true,
        hoursRun: true,
      },
      orderBy: [
        { equipmentId: "asc" },
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

  const approvedByEquipment = new Map<string, ApprovedEntryRow[]>();
  for (const entry of allApprovedEntries) {
    const rows = approvedByEquipment.get(entry.equipmentId) ?? [];
    rows.push({ entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) });
    approvedByEquipment.set(entry.equipmentId, rows);
  }

  const approvedCountMap = new Map(
    approvedCounts.map((c) => [c.equipmentId, c._count > 0])
  );

  const entriesWithPrevious = pendingEntries.map((entry) => {
    const previousEntry = findPreviousApprovedEntry(
      approvedByEquipment.get(entry.equipmentId) ?? [],
      entry.entryDate,
    );

    const hasAnyApprovedEntries = approvedCountMap.get(entry.equipmentId) ?? false;
    const previousHours = previousEntry
      ? Number(previousEntry.hoursRun)
      : hasAnyApprovedEntries
        ? 0
        : Number(entry.equipment.currentHours);

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
      previousHours: previousHours,
      currentEquipmentHours: Number(entry.equipment.currentHours),
    };
  });

  return ok(entriesWithPrevious);
}
