import { AlertLevel, CheckStatus, EntryStatus, TriggerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildYearlyPlan,
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
  determineStatus,
} from "@/lib/planning/engine";
import { getSystemThresholds } from "@/lib/planning/thresholds";

function toAlertLevel(status: CheckStatus) {
  if (status === CheckStatus.OVERDUE) {
    return AlertLevel.OVERDUE;
  }
  if (status === CheckStatus.NEAR_DUE) {
    return AlertLevel.NEAR_DUE;
  }
  if (status === CheckStatus.ISSUE_REQUIRED) {
    return AlertLevel.ISSUE_REQUIRED;
  }
  return AlertLevel.APPROACHING;
}

const ALERT_START_DATE = new Date("2026-04-01T00:00:00.000Z");

export async function syncEquipmentPlan(equipmentId: string, year: number) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      checkRules: {
        where: { isActive: true },
      },
      checkSheets: {
        where: { status: CheckStatus.COMPLETED },
        orderBy: [{ completedAt: "desc" }, { dueHours: "desc" }],
        take: 1,
        select: {
          completedAt: true,
          dueDate: true,
          dueHours: true,
          completedHours: true,
          checkCode: true,
        },
      },
    },
  });

  if (!equipment) {
    return null;
  }

  const allEntriesRaw = await prisma.dailyEntry.findMany({
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
  const allEntries = [...allEntriesRaw].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());

  const lastCompletedCheck = equipment.checkSheets[0];
  const lastCompletedAt = lastCompletedCheck?.completedAt ?? lastCompletedCheck?.dueDate ?? null;
  const lastCompletedHours = lastCompletedCheck ? Number(lastCompletedCheck.completedHours ?? lastCompletedCheck.dueHours) : null;

  const baselineDate = equipment.planningBaselineCheckDate ?? null;
  const baselineHours = equipment.planningBaselineHours != null ? Number(equipment.planningBaselineHours) : null;
  const baselineCheckCode = equipment.planningBaselineCheckCode ?? null;

  let anchorDate: Date;
  let startHours: number;
  let hourOffset = 0;

  const recurringRules = equipment.checkRules.filter((r) => r.intervalHours > 0);
  const orderedCycleRules = [...recurringRules].sort(
    (a, b) => Number(a.intervalHours) - Number(b.intervalHours) || a.code.localeCompare(b.code),
  );
  const baseInterval = orderedCycleRules.length > 0
    ? Math.min(...orderedCycleRules.map((r) => Number(r.intervalHours)).filter((v) => Number.isFinite(v) && v > 0))
    : null;
  const ratios = baseInterval
    ? orderedCycleRules.map((r) => Number(r.intervalHours) / baseInterval)
    : [];
  const isCycleMode =
    !!baseInterval &&
    ratios.length > 0 &&
    ratios.every((v, idx) => Number.isFinite(v) && Math.abs(v - (idx + 1)) <= 1e-9);

  const gcdInt = (a: number, b: number) => {
    const x = Math.abs(Math.trunc(a));
    const y = Math.abs(Math.trunc(b));
    if (x === 0) return y;
    if (y === 0) return x;
    let m = x;
    let n = y;
    while (n !== 0) {
      const t = n;
      n = m % n;
      m = t;
    }
    return m;
  };

  const theoreticalCodeAtHours = (hours: number) => {
    if (!baseInterval || orderedCycleRules.length === 0) return null;
    const ratio = hours / baseInterval;
    const nearest = Math.round(ratio);
    if (Math.abs(ratio - nearest) > 0.01) return null;
    if (nearest <= 0) return null;
    if (isCycleMode) {
      const index = (nearest - 1) % orderedCycleRules.length;
      return orderedCycleRules[index]?.code ?? null;
    }
    const eligible = orderedCycleRules.filter((rule) => {
      const interval = Number(rule.intervalHours);
      if (!Number.isFinite(interval) || interval <= 0) return false;
      const n = hours / interval;
      return Math.abs(n - Math.round(n)) <= 0.01;
    });
    if (eligible.length === 0) return null;
    const chosen = eligible.sort((a, b) => Number(b.intervalHours) - Number(a.intervalHours) || a.code.localeCompare(b.code))[0];
    return chosen?.code ?? null;
  };

  const snapToNearestMilestone = (targetCode: string | null, targetHours: number) => {
    const intervals = recurringRules.map((r) => Number(r.intervalHours)).filter((v) => Number.isFinite(v) && v > 0);
    if (intervals.length === 0) return { idealHours: targetHours, offsetHours: 0, snappedCode: targetCode };
    const step = baseInterval ?? (intervals.reduce((acc, v) => gcdInt(acc, v), intervals[0] ?? 1) || 1);
    const maxInterval = Math.max(...intervals);

    let span = Math.max(maxInterval * 4, 1000);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const kMin = Math.floor((targetHours - span) / step);
      const kMax = Math.ceil((targetHours + span) / step);
      let bestAny: { hours: number; code: string; diff: number } | null = null;
      let bestByCode: { hours: number; code: string; diff: number } | null = null;

      for (let k = kMin; k <= kMax; k += 1) {
        const milestone = k * step;
        if (!Number.isFinite(milestone) || milestone < 0) continue;
        const code = theoreticalCodeAtHours(milestone);
        if (!code) continue;
        const diff = Math.abs(milestone - targetHours);

        if (!bestAny || diff < bestAny.diff) {
          bestAny = { hours: milestone, code, diff };
        }
        if (targetCode && code === targetCode && (!bestByCode || diff < bestByCode.diff)) {
          bestByCode = { hours: milestone, code, diff };
        }
      }

      if (bestAny) {
        const chosen =
          bestByCode && bestByCode.diff <= bestAny.diff
            ? bestByCode
            : bestAny;
        return {
          idealHours: chosen.hours,
          offsetHours: targetHours - chosen.hours,
          snappedCode: chosen.code,
        };
      }

      span *= 2;
    }

    return { idealHours: targetHours, offsetHours: 0, snappedCode: targetCode };
  };

  let snappedStartingCode: string | null = baselineCheckCode;

  if (lastCompletedCheck && lastCompletedAt) {
    anchorDate = lastCompletedAt;
    const targetHours = lastCompletedHours ?? Number(equipment.currentHours);
    const snap = snapToNearestMilestone(lastCompletedCheck.checkCode ?? null, targetHours);
    startHours = snap.idealHours;
    hourOffset = snap.offsetHours;
    snappedStartingCode = snap.snappedCode ?? lastCompletedCheck.checkCode ?? null;
  } else if (baselineDate && baselineHours != null) {
    anchorDate = baselineDate;
    startHours = baselineHours;
    const snap = snapToNearestMilestone(baselineCheckCode, baselineHours);
    snappedStartingCode = snap.snappedCode ?? baselineCheckCode;
  } else {
    anchorDate = equipment.commissionedAt ?? new Date();
    startHours = Number(equipment.currentHours);
    snappedStartingCode = null;
  }

  const historicalDailyHours = deriveDailyRatesFromCumulativeReadings(
    allEntries.map((entry) => ({
      entryDate: entry.entryDate,
      hoursRun: Number(entry.hoursRun),
    })),
  );
  const forecastAverage = deriveForecastAverageHoursPerDay({
    latestAverage: Number(equipment.averageHoursPerDay),
    historicalDailyHours,
  });

  const thresholds = await getSystemThresholds();

  let plans = buildYearlyPlan({
    currentHours: Number(equipment.currentHours),
    averageHoursPerDay: forecastAverage,
    rules: equipment.checkRules,
    anchorDate,
    year,
    startHours,
    startingCheckCode: snappedStartingCode,
    thresholds,
  });

  if (plans.length === 0) {
    return plans;
  }

  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  plans = plans.map((p) => ({
    ...p,
    dueHours: p.dueHours + hourOffset,
  }));

  plans = plans.filter((p) => p.dueDate >= yearStart && p.dueDate <= yearEnd);
  if (lastCompletedAt) {
    plans = plans.filter((p) => p.dueDate > lastCompletedAt);
  }

  const now = new Date();
  const planKeys = plans.map((p) => ({
    equipmentId,
    checkCode: p.checkCode,
    dueHours: p.dueHours,
  }));

  const existingSheets = await prisma.checkSheet.findMany({
    where: {
      OR: planKeys.map((key) => ({
        equipmentId: key.equipmentId,
        checkCode: key.checkCode,
        dueHours: key.dueHours,
      })),
    },
    select: {
      id: true,
      equipmentId: true,
      checkCode: true,
      dueHours: true,
      status: true,
    },
  });

  const existingMap = new Map(
    existingSheets.map((s) => [`${s.equipmentId}:${s.checkCode}:${s.dueHours}`, s])
  );

  const toCreate: Array<{
    equipmentId: string;
    checkRuleId: string;
    checkCode: string;
    dueHours: number;
    dueDate: Date;
    triggerType: TriggerType;
    status: CheckStatus;
    completedAt?: Date;
    completedHours?: number;
  }> = [];

  const toUpdatePreserve: Array<{
    id: string;
    checkRuleId: string;
    dueDate: Date;
    triggerType: TriggerType;
  }> = [];

  const toUpdateStatus: Array<{
    id: string;
    checkRuleId: string;
    dueDate: Date;
    dueHours: number;
    triggerType: TriggerType;
    status: CheckStatus;
  }> = [];

  for (const plan of plans) {
    const key = `${equipmentId}:${plan.checkCode}:${plan.dueHours}`;
    const existing = existingMap.get(key);
    const status = determineStatus(plan.dueHours, Number(equipment.currentHours), plan.dueDate, now, thresholds);

    if (!existing) {
      toCreate.push({
        equipmentId,
        checkRuleId: plan.checkRuleId,
        checkCode: plan.checkCode,
        dueHours: plan.dueHours,
        dueDate: plan.dueDate,
        triggerType: plan.triggerType,
        status,
      });
    } else if (existing.status === CheckStatus.COMPLETED || existing.status === CheckStatus.ISSUED) {
      toUpdatePreserve.push({
        id: existing.id,
        checkRuleId: plan.checkRuleId,
        dueDate: plan.dueDate,
        triggerType: plan.triggerType,
      });
    } else {
      toUpdateStatus.push({
        id: existing.id,
        checkRuleId: plan.checkRuleId,
        dueDate: plan.dueDate,
        dueHours: plan.dueHours,
        triggerType: plan.triggerType,
        status,
      });
    }
  }

  if (toCreate.length > 0) {
    await prisma.checkSheet.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  if (toUpdatePreserve.length > 0) {
    await Promise.all(
      toUpdatePreserve.map((item) =>
        prisma.checkSheet.update({
          where: { id: item.id },
          data: {
            checkRuleId: item.checkRuleId,
            dueDate: item.dueDate,
            triggerType: item.triggerType,
          },
        })
      )
    );
  }

  if (toUpdateStatus.length > 0) {
    await Promise.all(
      toUpdateStatus.map((item) =>
        prisma.checkSheet.update({
          where: { id: item.id },
          data: {
            checkRuleId: item.checkRuleId,
            dueDate: item.dueDate,
            triggerType: item.triggerType,
            status: item.status,
            completedAt: null,
            completedHours: null,
          },
        })
      )
    );
  }

  await prisma.checkSheet.deleteMany({
    where: {
      equipmentId,
      dueDate: {
        gte: yearStart,
        lte: yearEnd,
      },
      status: {
        in: [
          CheckStatus.PREDICTED,
          CheckStatus.ISSUE_REQUIRED,
          CheckStatus.NEAR_DUE,
          CheckStatus.OVERDUE,
        ],
      },
      NOT: {
        OR: planKeys.map((k) => ({
          checkCode: k.checkCode,
          dueHours: k.dueHours,
        })),
      },
    },
  });

  if (now >= ALERT_START_DATE) {
    await prisma.alert.deleteMany({
      where: {
        equipmentId,
        acknowledged: false,
      },
    });
  }

  const freshSheets = await prisma.checkSheet.findMany({
    where: {
      equipmentId,
      status: {
        in: [
          CheckStatus.PREDICTED,
          CheckStatus.ISSUE_REQUIRED,
          CheckStatus.NEAR_DUE,
          CheckStatus.OVERDUE,
        ],
      },
    },
    select: {
      id: true,
      dueHours: true,
      dueDate: true,
      status: true,
    },
  });

  const currentHours = Number(equipment.currentHours);

  const statusUpdates: Array<{
    id: string;
    status: CheckStatus;
  }> = [];

  for (const sheet of freshSheets) {
    const updatedStatus = determineStatus(
      Number(sheet.dueHours),
      currentHours,
      sheet.dueDate,
      now,
      thresholds,
    );

    if (updatedStatus !== sheet.status) {
      statusUpdates.push({
        id: sheet.id,
        status: updatedStatus,
      });
    }
  }

  if (statusUpdates.length > 0) {
    await Promise.all(
      statusUpdates.map((item) =>
        prisma.checkSheet.update({
          where: { id: item.id },
          data: { status: item.status },
        })
      )
    );
  }

  const finalSheets = await prisma.checkSheet.findMany({
    where: {
      equipmentId,
      status: {
        in: [
          CheckStatus.PREDICTED,
          CheckStatus.ISSUE_REQUIRED,
          CheckStatus.NEAR_DUE,
          CheckStatus.OVERDUE,
        ],
      },
    },
    select: {
      id: true,
      checkCode: true,
      status: true,
    },
  });

  if (now >= ALERT_START_DATE && finalSheets.length > 0) {
    await prisma.alert.createMany({
      data: finalSheets.map((sheet) => ({
        equipmentId,
        checkSheetId: sheet.id,
        level: toAlertLevel(sheet.status),
        message: `${sheet.checkCode} check ${sheet.status.toLowerCase().replaceAll("_", " ")}`,
      })),
      skipDuplicates: true,
    });
  }

  return plans;
}
