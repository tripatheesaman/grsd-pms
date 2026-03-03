import { AlertLevel, CheckStatus, TriggerType } from "@prisma/client";
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
        },
      },
      entries: {
        select: { hoursRun: true },
        orderBy: { entryDate: "asc" },
        take: 45,
      },
    },
  });

  if (!equipment) {
    return null;
  }

  const lastCompletedCheck = equipment.checkSheets[0];
  const anchorDate =
    lastCompletedCheck?.completedAt ??
    equipment.commissionedAt ??
    new Date();

  const forecastAverage = deriveForecastAverageHoursPerDay({
    latestAverage: Number(equipment.averageHoursPerDay),
    historicalDailyHours: equipment.entries.map((item) => Number(item.hoursRun)),
  });

  const startHours = lastCompletedCheck
    ? Number(lastCompletedCheck.dueHours)
    : Number(equipment.currentHours);

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

  await prisma.$transaction(async (tx) => {
    if (updateAverage) {
      await tx.equipment.update({
        where: { id: equipmentId },
        data: { averageHoursPerDay: forecastAverage },
      });
    }

    if (toCreate.length > 0) {
      await tx.checkSheet.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    if (toUpdatePreserve.length > 0) {
      await Promise.all(
        toUpdatePreserve.map((item) =>
          tx.checkSheet.update({
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
          tx.checkSheet.update({
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
  });

  await prisma.alert.deleteMany({
    where: {
      equipmentId,
      acknowledged: false,
    },
  });

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

  const now = new Date();
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

  if (finalSheets.length > 0) {
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
