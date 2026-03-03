import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const approveDaySchema = z.object({
  entryDate: z.string().date(),
});

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, approveDaySchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const day = new Date(parsed.data.entryDate);
  day.setHours(0, 0, 0, 0);
  const nextDay = new Date(day);
  nextDay.setDate(day.getDate() + 1);

  const pendingEntries = await prisma.dailyEntry.findMany({
    where: {
      status: EntryStatus.PENDING,
      entryDate: {
        gte: day,
        lt: nextDay,
      },
    },
    include: {
      equipment: {
        select: {
          id: true,
          currentHours: true,
          averageHoursPerDay: true,
        },
      },
    },
    orderBy: {
      entryDate: "asc",
    },
  });

  if (pendingEntries.length === 0) {
    return fail("NOT_FOUND", "No pending entries found for this date", 404);
  }

  const equipmentIds = [...new Set(pendingEntries.map((e) => e.equipmentId))];
  const maxEntryDate = new Date(Math.max(...pendingEntries.map((e) => e.entryDate.getTime())));

  const [allPreviousEntries, approvedCounts, allRecentEntries] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
        entryDate: { lt: maxEntryDate },
      },
      select: {
        equipmentId: true,
        entryDate: true,
        hoursRun: true,
      },
      orderBy: [
        { equipmentId: "asc" },
        { entryDate: "desc" },
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
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
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
      take: equipmentIds.length * 45,
    }),
  ]);

  const previousMap = new Map<string, { entryDate: Date; hoursRun: number }>();
  for (const entry of allPreviousEntries) {
    const key = entry.equipmentId;
    if (!previousMap.has(key) || entry.entryDate > previousMap.get(key)!.entryDate) {
      previousMap.set(key, { entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) });
    }
  }

  const approvedCountMap = new Map(
    approvedCounts.map((c) => [c.equipmentId, c._count > 0])
  );

  const recentEntriesMap = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const entry of allRecentEntries) {
    if (!recentEntriesMap.has(entry.equipmentId)) {
      recentEntriesMap.set(entry.equipmentId, []);
    }
    recentEntriesMap.get(entry.equipmentId)!.push({
      entryDate: entry.entryDate,
      hoursRun: Number(entry.hoursRun),
    });
  }

  const validEntries = pendingEntries.filter((entry) => {
    const previousEntry = previousMap.get(entry.equipmentId);
    const hasAnyApprovedEntries = approvedCountMap.get(entry.equipmentId) ?? false;
    const previousHours = previousEntry
      ? Number(previousEntry.hoursRun)
      : hasAnyApprovedEntries
        ? 0
        : Number(entry.equipment.currentHours);

    return Number(entry.hoursRun) >= previousHours;
  });

  if (validEntries.length === 0) {
    return fail("BAD_REQUEST", "No valid entries to approve for this date", 400);
  }

  const equipmentUpdates = new Map<string, { averageHoursPerDay: number; currentHours: number }>();
  const entryUpdates: Array<{ id: string; equipmentId: string }> = [];
  const equipmentIdsToSync = new Set<string>();

  for (const entry of validEntries) {
    const previousEntry = previousMap.get(entry.equipmentId);
    const hasAnyApprovedEntries = approvedCountMap.get(entry.equipmentId) ?? false;
    const previousHours = previousEntry
      ? Number(previousEntry.hoursRun)
      : hasAnyApprovedEntries
        ? 0
        : Number(entry.equipment.currentHours);

    const recentEntries = recentEntriesMap.get(entry.equipmentId) ?? [];
    const sortedWithNew = [
      ...recentEntries.map((e) => ({ date: e.entryDate, hours: e.hoursRun })),
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
      ? Math.max(...recentEntries.map((e) => e.hoursRun))
      : Number(entry.equipment.currentHours);
    const newCurrentHours = Math.max(Number(entry.hoursRun), maxApprovedHours);

    if (!equipmentUpdates.has(entry.equipmentId)) {
      equipmentUpdates.set(entry.equipmentId, {
        averageHoursPerDay: newAverage,
        currentHours: newCurrentHours,
      });
    } else {
      const existing = equipmentUpdates.get(entry.equipmentId)!;
      equipmentUpdates.set(entry.equipmentId, {
        averageHoursPerDay: newAverage,
        currentHours: Math.max(existing.currentHours, newCurrentHours),
      });
    }

    entryUpdates.push({
      id: entry.id,
      equipmentId: entry.equipmentId,
    });

    equipmentIdsToSync.add(entry.equipmentId);
  }

  await prisma.$transaction(async (tx) => {
    await Promise.all(
      entryUpdates.map((item) =>
        tx.dailyEntry.update({
          where: { id: item.id },
          data: {
            status: EntryStatus.APPROVED,
            approvedById: access.user.id,
            approvedAt: new Date(),
          },
        })
      )
    );

    await Promise.all(
      Array.from(equipmentUpdates.entries()).map(([equipmentId, data]) =>
        tx.equipment.update({
          where: { id: equipmentId },
          data: {
            averageHoursPerDay: data.averageHoursPerDay,
            currentHours: data.currentHours,
          },
        })
      )
    );
  });

  await Promise.all(
    Array.from(equipmentIdsToSync).map((equipmentId) =>
      syncEquipmentPlan(equipmentId, new Date().getFullYear())
    )
  );

  await Promise.all(
    entryUpdates.map((item) =>
      writeAuditLog({
        userId: access.user.id,
        action: "equipment.entry.approve.batch",
        entityType: "DailyEntry",
        entityId: item.id,
        payload: {
          batchDate: day.toISOString(),
        },
        request,
      })
    )
  );

  return ok({
    approvedCount: validEntries.length,
    date: day.toISOString(),
  });
}
