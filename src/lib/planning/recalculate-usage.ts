import { EntryStatus } from "@prisma/client";
import {
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
} from "@/lib/planning/engine";
import { prisma } from "@/lib/prisma";

export async function recalculateEquipmentUsage(equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      averageHoursPerDay: true,
      currentHours: true,
    },
  });
  if (!equipment) return null;

  const approvedEntriesRaw = await prisma.dailyEntry.findMany({
    where: {
      equipmentId,
      status: EntryStatus.APPROVED,
    },
    select: {
      hoursRun: true,
      entryDate: true,
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 120,
  });
  const approvedEntries = [...approvedEntriesRaw].sort(
    (a, b) => a.entryDate.getTime() - b.entryDate.getTime(),
  );

  const dailyRates = deriveDailyRatesFromCumulativeReadings(
    approvedEntries.map((entry) => ({
      entryDate: entry.entryDate,
      hoursRun: Number(entry.hoursRun),
    })),
  );

  let averageHoursPerDay = Number(equipment.averageHoursPerDay);
  if (dailyRates.length > 0) {
    averageHoursPerDay = deriveForecastAverageHoursPerDay({
      // Use an entry-derived baseline so repeated recalculations stay deterministic.
      latestAverage: 0,
      historicalDailyHours: dailyRates,
    });
  }

  const maxApproved = await prisma.dailyEntry.aggregate({
    where: {
      equipmentId,
      status: EntryStatus.APPROVED,
    },
    _max: {
      hoursRun: true,
    },
  });
  const maxApprovedHours = maxApproved._max.hoursRun != null
    ? Number(maxApproved._max.hoursRun)
    : Number(equipment.currentHours);
  const currentHours = Math.max(Number(equipment.currentHours), maxApprovedHours);

  const updated = await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      averageHoursPerDay,
      currentHours,
    },
    select: {
      id: true,
      averageHoursPerDay: true,
      currentHours: true,
    },
  });

  return {
    id: updated.id,
    averageHoursPerDay: Number(updated.averageHoursPerDay),
    currentHours: Number(updated.currentHours),
  };
}
