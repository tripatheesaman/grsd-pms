import { AlertLevel, CheckStatus, EntryStatus, TriggerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildYearlyPlan, deriveForecastAverageHoursPerDay, determineStatus } from "@/lib/planning/engine";

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

let systemConfigCache: {
  approachingOffsetHours: number;
  issueOffsetHours: number;
  nearOffsetHours: number;
  timestamp: number;
} | null = null;

const CONFIG_CACHE_TTL = 60000;

const ALERT_START_DATE = new Date("2026-04-01T00:00:00.000Z");

async function getSystemThresholds() {
  const now = Date.now();
  if (systemConfigCache && (now - systemConfigCache.timestamp) < CONFIG_CACHE_TTL) {
    return {
      approachingOffsetHours: systemConfigCache.approachingOffsetHours,
      issueOffsetHours: systemConfigCache.issueOffsetHours,
      nearOffsetHours: systemConfigCache.nearOffsetHours,
    };
  }

  const [approachingConfig, issueConfig, nearConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "approaching_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "issue_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "near_offset_hours" } }).catch(() => null),
  ]);

  const thresholds = {
    approachingOffsetHours: approachingConfig ? Number(approachingConfig.value) : 120,
    issueOffsetHours: issueConfig ? Number(issueConfig.value) : 40,
    nearOffsetHours: nearConfig ? Number(nearConfig.value) : 10,
  };

  systemConfigCache = {
    ...thresholds,
    timestamp: now,
  };

  return thresholds;
}

export async function syncEquipmentPlan(equipmentId: string, year: number) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      checkRules: {
        where: { isActive: true },
      },
      checkSheets: {
        where: { status: CheckStatus.COMPLETED },
        orderBy: { completedAt: "desc" },
        take: 1,
        select: {
          completedAt: true,
          dueHours: true,
          completedHours: true,
        },
      },
    },
  });

  if (!equipment) {
    return null;
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

  const lastCompletedCheck = equipment.checkSheets[0];

  const baselineDate = equipment.planningBaselineCheckDate ?? null;
  const baselineHours = equipment.planningBaselineHours != null ? Number(equipment.planningBaselineHours) : null;

  let anchorDate: Date;
  let startHours: number;

  if (lastCompletedCheck && lastCompletedCheck.completedAt) {
    anchorDate =
      lastCompletedCheck.completedAt ??
      equipment.commissionedAt ??
      new Date();
    startHours = Number(lastCompletedCheck.completedHours ?? lastCompletedCheck.dueHours);
  } else if (baselineDate && baselineHours != null) {
    anchorDate = baselineDate;
    startHours = baselineHours;
  } else {
    anchorDate =
      equipment.commissionedAt ??
      new Date();
    startHours = Number(equipment.currentHours);
  }

  const historicalDailyHours: number[] = [];
  for (let i = 1; i < allEntries.length; i += 1) {
    const prev = Number(allEntries[i - 1]?.hoursRun);
    const curr = Number(allEntries[i]?.hoursRun);
    const delta = curr - prev;
    if (Number.isFinite(delta) && delta > 0) {
      historicalDailyHours.push(delta);
    }
  }
  const forecastAverage = deriveForecastAverageHoursPerDay({
    latestAverage: Number(equipment.averageHoursPerDay),
    historicalDailyHours,
  });

  const thresholds = await getSystemThresholds();

  const plans = buildYearlyPlan({
    currentHours: Number(equipment.currentHours),
    averageHoursPerDay: forecastAverage,
    rules: equipment.checkRules,
    anchorDate,
    year,
    startHours,
    thresholds,
  });

  if (plans.length === 0) {
    return plans;
  }

  const planKeys = plans.map((p) => ({
    equipmentId,
    checkCode: p.checkCode,
    dueHours: p.dueHours,
  }));

  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

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
    triggerType: TriggerType;
    status: CheckStatus;
  }> = [];

  for (const plan of plans) {
    const key = `${equipmentId}:${plan.checkCode}:${plan.dueHours}`;
    const existing = existingMap.get(key);

    if (!existing) {
      toCreate.push({
        equipmentId,
        checkRuleId: plan.checkRuleId,
        checkCode: plan.checkCode,
        dueHours: plan.dueHours,
        dueDate: plan.dueDate,
        triggerType: plan.triggerType,
        status: plan.status,
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
        triggerType: plan.triggerType,
        status: plan.status,
      });
    }
  }

  const updateAverage = Math.abs(forecastAverage - Number(equipment.averageHoursPerDay)) >= 0.01;

  if (updateAverage) {
    await prisma.equipment.update({
      where: { id: equipmentId },
      data: { averageHoursPerDay: forecastAverage },
    });
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

  const now = new Date();

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
