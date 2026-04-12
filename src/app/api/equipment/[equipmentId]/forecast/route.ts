import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { deriveDailyRatesFromCumulativeReadings } from "@/lib/planning/engine";
import { buildForecastMetrics } from "@/lib/planning/forecast-metrics";
import { segmentMaxesFromGroupBy, toLifetimeReadings } from "@/lib/planning/meter-segment";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.planRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await prisma.equipment.findUnique({
    where: {
      id: equipmentId,
    },
    select: {
      id: true,
      averageHoursPerDay: true,
    },
  });
  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const [segmentGroups, allEntries] = await Promise.all([
    prisma.dailyEntry.groupBy({
      by: ["meterSegment"],
      where: { equipmentId, status: EntryStatus.APPROVED },
      _max: { hoursRun: true },
    }),
    prisma.dailyEntry.findMany({
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
        entryDate: "asc",
      },
    }),
  ]);

  const fullSeg = segmentMaxesFromGroupBy(
    segmentGroups.map((g) => ({ meterSegment: g.meterSegment, _max: g._max })),
  );

  const dailySeries = deriveDailyRatesFromCumulativeReadings(
    toLifetimeReadings(
      allEntries.map((entry) => ({
        entryDate: entry.entryDate,
        hoursRun: Number(entry.hoursRun),
        meterSegment: entry.meterSegment,
      })),
      fullSeg,
    ),
  );

  const metrics = buildForecastMetrics(dailySeries, Number(equipment.averageHoursPerDay));

  return ok(metrics);
}
