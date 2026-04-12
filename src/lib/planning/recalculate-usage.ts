import { EntryStatus, Prisma } from "@prisma/client";
import {
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
} from "@/lib/planning/engine";
import {
  segmentMaxesFromGroupBy,
  toLifetimeReadings,
  totalLifetimeFromSegmentMaxes,
} from "@/lib/planning/meter-segment";
import { prisma } from "@/lib/prisma";

export async function recalculateEquipmentUsageBatch(equipmentIds: string[]) {
  const ids = [...new Set(equipmentIds)].filter(Boolean);
  if (ids.length === 0) return;

  const [equipmentRows, segmentGroups, recentRows] = await Promise.all([
    prisma.equipment.findMany({
      where: { id: { in: ids } },
      select: { id: true, averageHoursPerDay: true, currentHours: true },
    }),
    prisma.dailyEntry.groupBy({
      by: ["equipmentId", "meterSegment"],
      where: { equipmentId: { in: ids }, status: EntryStatus.APPROVED },
      _max: { hoursRun: true },
    }),
    prisma.$queryRaw<Array<{ equipmentId: string; entryDate: Date; hoursRun: unknown; meterSegment: number }>>`
      SELECT equipmentId, entryDate, hoursRun, meterSegment
      FROM (
        SELECT
          equipmentId,
          entryDate,
          hoursRun,
          meterSegment,
          ROW_NUMBER() OVER (PARTITION BY equipmentId ORDER BY entryDate DESC) AS rn
        FROM dailyentry
        WHERE equipmentId IN (${Prisma.join(ids)}) AND status = 'APPROVED'
      ) AS t
      WHERE t.rn <= 120
    `,
  ]);

  const segmentMaxByEquipment = new Map<string, Map<number, number>>();
  for (const g of segmentGroups) {
    if (g._max.hoursRun == null) continue;
    const inner = segmentMaxByEquipment.get(g.equipmentId) ?? new Map<number, number>();
    inner.set(g.meterSegment, Number(g._max.hoursRun));
    segmentMaxByEquipment.set(g.equipmentId, inner);
  }

  const entriesByEquipment = new Map<
    string,
    Array<{ entryDate: Date; hoursRun: number; meterSegment: number }>
  >();
  for (const row of recentRows) {
    const list = entriesByEquipment.get(row.equipmentId) ?? [];
    list.push({
      entryDate: row.entryDate,
      hoursRun: Number(row.hoursRun),
      meterSegment: row.meterSegment,
    });
    entriesByEquipment.set(row.equipmentId, list);
  }
  for (const list of entriesByEquipment.values()) {
    list.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  }

  const updatePromises: Array<Promise<unknown>> = [];
  for (const eq of equipmentRows) {
    const segMap = segmentMaxByEquipment.get(eq.id);
    const hasApproved = segMap != null && segMap.size > 0;
    const currentHours = hasApproved
      ? totalLifetimeFromSegmentMaxes(segMap!)
      : Number(eq.currentHours);

    const list = entriesByEquipment.get(eq.id) ?? [];
    const fullSeg = segMap ?? new Map<number, number>();
    const dailyRates =
      list.length > 0
        ? deriveDailyRatesFromCumulativeReadings(toLifetimeReadings(list, fullSeg))
        : [];

    let averageHoursPerDay = Number(eq.averageHoursPerDay);
    if (dailyRates.length > 0) {
      averageHoursPerDay = deriveForecastAverageHoursPerDay({
        latestAverage: 0,
        historicalDailyHours: dailyRates,
      });
    }

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

  const segmentGroups = await prisma.dailyEntry.groupBy({
    by: ["meterSegment"],
    where: { equipmentId, status: EntryStatus.APPROVED },
    _max: { hoursRun: true },
  });
  const fullSeg = segmentMaxesFromGroupBy(
    segmentGroups.map((g) => ({ meterSegment: g.meterSegment, _max: g._max })),
  );
  const hasApproved = fullSeg.size > 0;
  const totalLife = hasApproved ? totalLifetimeFromSegmentMaxes(fullSeg) : null;

  const approvedEntriesRaw = await prisma.dailyEntry.findMany({
    where: {
      equipmentId,
      status: EntryStatus.APPROVED,
    },
    select: {
      hoursRun: true,
      entryDate: true,
      meterSegment: true,
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
    toLifetimeReadings(
      approvedEntries.map((e) => ({
        entryDate: e.entryDate,
        hoursRun: Number(e.hoursRun),
        meterSegment: e.meterSegment,
      })),
      fullSeg,
    ),
  );

  let averageHoursPerDay = Number(equipment.averageHoursPerDay);
  if (dailyRates.length > 0) {
    averageHoursPerDay = deriveForecastAverageHoursPerDay({
      latestAverage: 0,
      historicalDailyHours: dailyRates,
    });
  }

  const currentHours =
    totalLife != null ? totalLife : Number(equipment.currentHours);

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
