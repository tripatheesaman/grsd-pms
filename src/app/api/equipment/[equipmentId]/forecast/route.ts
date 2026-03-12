import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { buildForecastMetrics } from "@/lib/planning/forecast-metrics";
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

  const allEntries = await prisma.dailyEntry.findMany({
    where: {
      equipmentId,
      status: EntryStatus.APPROVED,
    },
    select: {
      hoursRun: true,
      entryDate: true,
    },
    orderBy: {
      entryDate: "asc",
    },
  });

  const metrics = buildForecastMetrics(
    allEntries.map((entry) => Number(entry.hoursRun)),
    Number(equipment.averageHoursPerDay),
  );

  return ok(metrics);
}
