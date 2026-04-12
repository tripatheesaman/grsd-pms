import { EntryStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type ApprovedReadingRow = {
  entryDate: Date;
  hoursRun: number;
};

export function findPreviousApprovedReading(
  approvedRowsSortedByDateAsc: ApprovedReadingRow[],
  currentEntryDate: Date,
): ApprovedReadingRow | null {
  let left = 0;
  let right = approvedRowsSortedByDateAsc.length - 1;
  let resultIndex = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midMs = approvedRowsSortedByDateAsc[mid]!.entryDate.getTime();
    if (midMs < currentEntryDate.getTime()) {
      resultIndex = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return resultIndex >= 0 ? approvedRowsSortedByDateAsc[resultIndex]! : null;
}

export function minimumReadingFromContext(
  segmentRowsSortedAsc: ApprovedReadingRow[],
  currentEntryDate: Date,
  equipmentHasAnyApproved: boolean,
  equipmentCurrentHours: number,
): number {
  const prev = findPreviousApprovedReading(segmentRowsSortedAsc, currentEntryDate);
  if (prev) {
    return prev.hoursRun;
  }
  if (equipmentHasAnyApproved) {
    return 0;
  }
  return equipmentCurrentHours;
}

export async function minimumReadingForDailyEntry(
  prisma: PrismaClient,
  args: {
    equipmentId: string;
    meterSegment: number;
    beforeEntryDate: Date;
    equipmentCurrentHours: number;
    excludeEntryId?: string;
  },
): Promise<number> {
  const previousEntry = await prisma.dailyEntry.findFirst({
    where: {
      equipmentId: args.equipmentId,
      status: EntryStatus.APPROVED,
      meterSegment: args.meterSegment,
      entryDate: { lt: args.beforeEntryDate },
      ...(args.excludeEntryId ? { id: { not: args.excludeEntryId } } : {}),
    },
    orderBy: { entryDate: "desc" },
    select: { hoursRun: true },
  });

  if (previousEntry) {
    return Number(previousEntry.hoursRun);
  }

  const anyApproved = await prisma.dailyEntry.count({
    where: {
      equipmentId: args.equipmentId,
      status: EntryStatus.APPROVED,
    },
  });

  if (anyApproved > 0) {
    return 0;
  }

  return args.equipmentCurrentHours;
}
