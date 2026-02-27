import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { buildForecastMetrics } from "@/lib/planning/forecast-metrics";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type DriftAccumulator = {
  equipmentCount: number;
  totalMape: number;
  totalRecentMean: number;
  totalPriorMean: number;
};

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.forecastDriftRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const equipments = await prisma.equipment.findMany({
    where: {
      isActive: true,
    },
    include: {
      entries: {
        select: {
          hoursRun: true,
        },
        orderBy: {
          entryDate: "asc",
        },
      },
    },
  });

  const byClass = new Map<string, DriftAccumulator>();
  for (const equipment of equipments) {
    const series = equipment.entries.map((entry) => Number(entry.hoursRun)).filter((value) => value > 0);
    if (series.length < 10) {
      continue;
    }
    const metrics = buildForecastMetrics(series, Number(equipment.averageHoursPerDay));
    const recent = mean(series.slice(-14));
    const prior = mean(series.slice(-28, -14));
    const key = equipment.equipmentClass || "GENERAL";
    const current = byClass.get(key) ?? {
      equipmentCount: 0,
      totalMape: 0,
      totalRecentMean: 0,
      totalPriorMean: 0,
    };
    current.equipmentCount += 1;
    current.totalMape += metrics.meanAbsolutePercentageError;
    current.totalRecentMean += recent;
    current.totalPriorMean += prior;
    byClass.set(key, current);
  }

  const items = [...byClass.entries()]
    .map(([equipmentClass, value]) => {
      const avgMape = value.totalMape / value.equipmentCount;
      const driftPercent =
        value.totalPriorMean > 0
          ? ((value.totalRecentMean - value.totalPriorMean) / value.totalPriorMean) * 100
          : 0;
      const riskLevel =
        avgMape > 20 || Math.abs(driftPercent) > 25
          ? "high"
          : avgMape > 10 || Math.abs(driftPercent) > 12
            ? "medium"
            : "low";
      return {
        equipmentClass,
        equipmentCount: value.equipmentCount,
        averageMape: Number(avgMape.toFixed(2)),
        driftPercent: Number(driftPercent.toFixed(2)),
        riskLevel,
      };
    })
    .sort((a, b) => b.averageMape - a.averageMape);

  return ok(items);
}
