import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const MAX_HOURS_RUN = 1_000_000;

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
  const recentCounts = new Map<string, number>();
  for (const entry of allRecentEntries) {
    const current = recentCounts.get(entry.equipmentId) ?? 0;
    if (current >= 45) {
      continue;
    }
    recentCounts.set(entry.equipmentId, current + 1);
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
    const previousHours = previousEntry ? Number(previousEntry.hoursRun) : 0;

    const hoursRun = Number(entry.hoursRun);
    if (!Number.isFinite(hoursRun) || hoursRun <= 0 || hoursRun > MAX_HOURS_RUN) {
      return false;
    }
    return hoursRun >= previousHours;
  });

  const invalidCount = pendingEntries.length - validEntries.length;

  const equipmentUpdates = new Map<string, { averageHoursPerDay: number; currentHours: number }>();
  const entryUpdates: Array<{ id: string; equipmentId: string }> = [];
  const equipmentIdsToSync = new Set<string>();

  for (const entry of validEntries) {
    const previousEntry = previousMap.get(entry.equipmentId);
    const previousHours = previousEntry ? Number(previousEntry.hoursRun) : 0;

    const recentEntries = recentEntriesMap.get(entry.equipmentId) ?? [];
    const sortedWithNew = [
      ...recentEntries.map((e) => ({ date: e.entryDate, hours: e.hoursRun })),
      { date: entry.entryDate, hours: Number(entry.hoursRun) },
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const dailyDeltas: number[] = [];
    let prevCumulative = previousEntry ? Number(previousEntry.hoursRun) : (sortedWithNew[0]?.hours ?? 0);
    for (let i = 0; i < sortedWithNew.length; i += 1) {
      const item = sortedWithNew[i];
      if (i === 0 && !previousEntry) {
        prevCumulative = item.hours;
        continue;
      }
      const delta = Math.max(0, item.hours - prevCumulative);
      if (delta > 0) dailyDeltas.push(delta);
      prevCumulative = item.hours;
    }

    const dailyIncrementForNew = previousEntry ? Math.max(0, Number(entry.hoursRun) - previousHours) : 0;
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

  const approvedAt = new Date();
  const idsToApprove = entryUpdates.map((e) => e.id);

  if (idsToApprove.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.dailyEntry.updateMany({
        where: { id: { in: idsToApprove } },
        data: {
          status: EntryStatus.APPROVED,
          approvedById: access.user.id,
          approvedAt,
        },
      });

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
  }

  for (const equipmentId of equipmentIdsToSync) {
    syncEquipmentPlan(equipmentId, new Date().getFullYear()).catch(() => null);
  }

  writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.approve.batch",
    entityType: "DailyEntry",
    entityId: null,
    payload: {
      batchDate: day.toISOString(),
      approvedCount: idsToApprove.length,
      invalidCount,
    },
    request,
  }).catch(() => null);

  return ok({
    approvedCount: idsToApprove.length,
    invalidCount,
    date: day.toISOString(),
  });
}
