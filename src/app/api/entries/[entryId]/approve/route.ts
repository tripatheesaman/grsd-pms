import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveDailyRatesFromCumulativeReadings, deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const { entryId } = await context.params;

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      equipment: {
        select: {
          id: true,
          currentHours: true,
          averageHoursPerDay: true,
        },
      },
    },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }

  if (entry.status !== EntryStatus.PENDING) {
    return fail("BAD_REQUEST", "Entry is not pending approval", 400);
  }

  const [previousEntry, recentEntries] = await Promise.all([
    prisma.dailyEntry.findFirst({
      where: {
        equipmentId: entry.equipmentId,
        status: EntryStatus.APPROVED,
        entryDate: {
          lt: entry.entryDate,
        },
      },
      orderBy: {
        entryDate: "desc",
      },
      select: {
        entryDate: true,
        hoursRun: true,
      },
    }),
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: entry.equipmentId,
        status: EntryStatus.APPROVED,
      },
      select: {
        entryDate: true,
        hoursRun: true,
      },
      orderBy: {
        entryDate: "desc",
      },
      take: 90,
    }),
  ]);

  const previousHoursForValidation = previousEntry ? Number(previousEntry.hoursRun) : 0;

  if (Number(entry.hoursRun) < previousHoursForValidation) {
    return fail(
      "BAD_REQUEST",
      `Hours must be at least ${previousHoursForValidation.toFixed(2)} (previous entry hours)`,
      400,
    );
  }

  const sortedWithNew = [
    ...recentEntries.map((e) => ({ entryDate: e.entryDate, hoursRun: Number(e.hoursRun) })),
    { entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) },
  ]
    .sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime())
    .slice(0, 90)
    .sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const dailyDeltas = deriveDailyRatesFromCumulativeReadings(sortedWithNew);

  let dailyIncrementForNew: number | undefined;
  if (previousEntry) {
    const rawDelta = Math.max(0, Number(entry.hoursRun) - Number(previousEntry.hoursRun));
    const dayMs = 24 * 60 * 60 * 1000;
    const rawDays = (entry.entryDate.getTime() - previousEntry.entryDate.getTime()) / dayMs;
    const days = Math.max(1, Math.round(rawDays));
    const rate = rawDelta / days;
    if (Number.isFinite(rate) && rate > 0) dailyIncrementForNew = rate;
  }

  const newAverage = deriveForecastAverageHoursPerDay({
    latestAverage: Number(entry.equipment.averageHoursPerDay),
    historicalDailyHours: dailyDeltas,
    upcomingEnteredHours: dailyIncrementForNew,
  });

  const maxApprovedHours = recentEntries.length > 0
    ? Math.max(...recentEntries.map((e) => Number(e.hoursRun)))
    : Number(entry.equipment.currentHours);
  const newCurrentHours = Math.max(Number(entry.hoursRun), maxApprovedHours);

  await prisma.$transaction([
    prisma.dailyEntry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.APPROVED,
        approvedById: access.user.id,
        approvedAt: new Date(),
      },
    }),
    prisma.equipment.update({
      where: { id: entry.equipmentId },
      data: {
        averageHoursPerDay: newAverage,
        currentHours: newCurrentHours,
      },
    }),
  ]);

  syncEquipmentPlan(entry.equipmentId, new Date().getFullYear()).catch(() => null);

  writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.approve",
    entityType: "DailyEntry",
    entityId: entryId,
    payload: {
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
      averageHoursPerDay: Number(newAverage.toFixed(2)),
      newCurrentHours: Number(newCurrentHours.toFixed(2)),
    },
    request,
  }).catch(() => null);

  return ok({
    id: entryId,
    status: EntryStatus.APPROVED,
    averageHoursPerDay: Number(newAverage.toFixed(2)),
    currentHours: Number(newCurrentHours.toFixed(2)),
  });
}
