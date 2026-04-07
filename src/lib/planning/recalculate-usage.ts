import { EntryStatus, Prisma } from "@prisma/client";
import {
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
} from "@/lib/planning/engine";
import { prisma } from "@/lib/prisma";

/**
 * Recomputes usage for many equipment in a small number of queries (vs N× per-id recalculations).
 * Uses MySQL 8 window functions for “last 120 approved entries per equipment”.
 */
export async function recalculateEquipmentUsageBatch(equipmentIds: string[]) {
  const ids = [...new Set(equipmentIds)].filter(Boolean);
  if (ids.length === 0) return;

  const [equipmentRows, maxByEquipment, recentRows] = await Promise.all([
    prisma.equipment.findMany({
      where: { id: { in: ids } },
      select: { id: true, averageHoursPerDay: true, currentHours: true },
    }),
    prisma.dailyEntry.groupBy({
      by: ["equipmentId"],
      where: { equipmentId: { in: ids }, status: EntryStatus.APPROVED },
      _max: { hoursRun: true },
    }),
    prisma.$queryRaw<Array<{ equipmentId: string; entryDate: Date; hoursRun: unknown }>>`
      SELECT equipmentId, entryDate, hoursRun
      FROM (
        SELECT
          equipmentId,
          entryDate,
          hoursRun,
          ROW_NUMBER() OVER (PARTITION BY equipmentId ORDER BY entryDate DESC) AS rn
        FROM dailyentry
        WHERE equipmentId IN (${Prisma.join(ids)}) AND status = 'APPROVED'
      ) AS t
      WHERE t.rn <= 120
    `,
  ]);

  const maxMap = new Map<string, number>();
  for (const g of maxByEquipment) {
    if (g._max.hoursRun != null) {
      maxMap.set(g.equipmentId, Number(g._max.hoursRun));
    }
  }

  const entriesByEquipment = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const row of recentRows) {
    const list = entriesByEquipment.get(row.equipmentId) ?? [];
    list.push({ entryDate: row.entryDate, hoursRun: Number(row.hoursRun) });
    entriesByEquipment.set(row.equipmentId, list);
  }
  for (const list of entriesByEquipment.values()) {
    list.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  }

  const updatePromises: Array<Promise<unknown>> = [];
  for (const eq of equipmentRows) {
    const list = entriesByEquipment.get(eq.id) ?? [];
    const dailyRates = deriveDailyRatesFromCumulativeReadings(
      list.map((e) => ({ entryDate: e.entryDate, hoursRun: e.hoursRun })),
    );

    let averageHoursPerDay = Number(eq.averageHoursPerDay);
    if (dailyRates.length > 0) {
      averageHoursPerDay = deriveForecastAverageHoursPerDay({
        latestAverage: 0,
        historicalDailyHours: dailyRates,
      });
    }

    const maxApprovedHours = maxMap.has(eq.id)
      ? maxMap.get(eq.id)!
      : Number(eq.currentHours);
    const currentHours = Math.max(Number(eq.currentHours), maxApprovedHours);

    updatePromises.push(
      prisma.equipment.update({
        where: { id: eq.id },
        data: { averageHoursPerDay, currentHours },
      }),
    );
  }

  const UPDATE_CHUNK = 100;
  for (let i = 0; i < updatePromises.length; i += UPDATE_CHUNK) {
    await Promise.all(updatePromises.slice(i, i + UPDATE_CHUNK));
  }
}

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
