import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";
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
      equipment: true,
    },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }

  if (entry.status !== EntryStatus.PENDING) {
    return fail("BAD_REQUEST", "Entry is not pending approval", 400);
  }

  const previousEntry = await prisma.dailyEntry.findFirst({
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
  });

  const hasAnyApprovedEntries = await prisma.dailyEntry.count({
    where: {
      equipmentId: entry.equipmentId,
      status: EntryStatus.APPROVED,
    },
  }) > 0;

  const previousHours = previousEntry
    ? Number(previousEntry.hoursRun)
    : hasAnyApprovedEntries
      ? 0
      : Number(entry.equipment.currentHours);

  if (Number(entry.hoursRun) < previousHours) {
    return fail("BAD_REQUEST", `Hours must be at least ${previousHours.toFixed(2)} (previous entry hours)`, 400);
  }

  const recentEntries = await prisma.dailyEntry.findMany({
    where: {
      equipmentId: entry.equipmentId,
      status: EntryStatus.APPROVED,
    },
    select: {
      entryDate: true,
      hoursRun: true,
    },
    orderBy: {
      entryDate: "asc",
    },
    take: 45,
  });

  const sortedWithNew = [
    ...recentEntries.map((e) => ({ date: e.entryDate, hours: Number(e.hoursRun) })),
    { date: entry.entryDate, hours: Number(entry.hoursRun) },
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const dailyDeltas: number[] = [];
  let prevCumulative = previousHours;
  for (const item of sortedWithNew) {
    const delta = Math.max(0, item.hours - prevCumulative);
    if (delta > 0) {
      dailyDeltas.push(delta);
    }
    prevCumulative = item.hours;
  }

  const dailyIncrementForNew = Math.max(0, Number(entry.hoursRun) - previousHours);

  const newAverage = deriveForecastAverageHoursPerDay({
    latestAverage: Number(entry.equipment.averageHoursPerDay),
    historicalDailyHours: dailyDeltas,
    upcomingEnteredHours: dailyIncrementForNew > 0 ? dailyIncrementForNew : undefined,
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

  await syncEquipmentPlan(entry.equipmentId, new Date().getFullYear());

  await writeAuditLog({
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
  });

  return ok({
    id: entryId,
    status: EntryStatus.APPROVED,
    averageHoursPerDay: Number(newAverage.toFixed(2)),
    currentHours: Number(newCurrentHours.toFixed(2)),
  });
}
