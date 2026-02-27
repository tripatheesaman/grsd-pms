import { AlertLevel, CheckStatus } from "@prisma/client";
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

export async function syncEquipmentPlan(equipmentId: string, year: number) {
  const equipment = await prisma.equipment.findUnique({
    where: {
      id: equipmentId,
    },
    include: {
      checkRules: {
        where: {
          isActive: true,
        },
      },
      checkSheets: {
        where: {
          status: CheckStatus.COMPLETED,
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 1,
      },
      entries: {
        select: {
          hoursRun: true,
        },
        orderBy: {
          entryDate: "asc",
        },
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

  if (Math.abs(forecastAverage - Number(equipment.averageHoursPerDay)) >= 0.01) {
    await prisma.equipment.update({
      where: {
        id: equipmentId,
      },
      data: {
        averageHoursPerDay: forecastAverage,
      },
    });
  }

  const startHours = lastCompletedCheck
    ? Number(lastCompletedCheck.dueHours)
    : Number(equipment.currentHours);

  const [approachingConfig, issueConfig, nearConfig] = await Promise.all([
    (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }).catch(() => null),
    (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }).catch(() => null),
    (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }).catch(() => null),
  ]);

  const thresholds = {
    approachingOffsetHours: approachingConfig ? Number(approachingConfig.value) : 120,
    issueOffsetHours: issueConfig ? Number(issueConfig.value) : 40,
    nearOffsetHours: nearConfig ? Number(nearConfig.value) : 10,
  };

  const plans = buildYearlyPlan({
    currentHours: Number(equipment.currentHours),
    averageHoursPerDay: forecastAverage,
    rules: equipment.checkRules,
    anchorDate,
    year,
    startHours,
    thresholds,
  });

  for (const plan of plans) {
    const existingSheet = await prisma.checkSheet.findUnique({
      where: {
        equipmentId_checkCode_dueHours: {
          equipmentId,
          checkCode: plan.checkCode,
          dueHours: plan.dueHours,
        },
      },
    });

    if (!existingSheet) {
      await prisma.checkSheet.create({
        data: {
          equipmentId,
          checkRuleId: plan.checkRuleId,
          checkCode: plan.checkCode,
          dueHours: plan.dueHours,
          dueDate: plan.dueDate,
          triggerType: plan.triggerType,
          status: plan.status,
        },
      });
      continue;
    }

    // Preserve manually controlled lifecycle states
    if (existingSheet.status === CheckStatus.COMPLETED || existingSheet.status === CheckStatus.ISSUED) {
      await prisma.checkSheet.update({
        where: { id: existingSheet.id },
        data: {
          checkRuleId: plan.checkRuleId,
          dueDate: plan.dueDate,
          triggerType: plan.triggerType,
        },
      });
    } else {
      await prisma.checkSheet.update({
        where: { id: existingSheet.id },
        data: {
          checkRuleId: plan.checkRuleId,
          dueDate: plan.dueDate,
          triggerType: plan.triggerType,
          status: plan.status,
        },
      });
    }
  }

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
  });

  const now = new Date();
  const currentHours = Number(equipment.currentHours);

  for (const sheet of freshSheets) {
    const updatedStatus = determineStatus(
      Number(sheet.dueHours),
      currentHours,
      sheet.dueDate,
      now,
      thresholds,
    );

    if (updatedStatus !== sheet.status) {
      await prisma.checkSheet.update({
        where: { id: sheet.id },
        data: { status: updatedStatus },
      });
      sheet.status = updatedStatus;
    }
  }

  if (freshSheets.length > 0) {
    await prisma.alert.createMany({
      data: freshSheets.map((sheet) => ({
        equipmentId,
        checkSheetId: sheet.id,
        level: toAlertLevel(sheet.status),
        message: `${sheet.checkCode} check ${sheet.status.toLowerCase().replaceAll("_", " ")}`,
      })),
    });
  }

  return plans;
}
