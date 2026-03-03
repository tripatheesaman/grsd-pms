import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { determineStatus } from "@/lib/planning/engine";

function addMonths(date: Date, months: number) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
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

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.checksheetRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const thresholds = await getSystemThresholds();
  const now = new Date();

  const checkSheets = await prisma.checkSheet.findMany({
    where: {
      status: {
        in: [
          CheckStatus.PREDICTED,
          CheckStatus.ISSUE_REQUIRED,
          CheckStatus.NEAR_DUE,
          CheckStatus.ISSUED,
          CheckStatus.OVERDUE,
          CheckStatus.COMPLETED,
        ],
      },
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
          displayName: true,
          currentHours: true,
          usageUnit: true,
          groundingPeriods: {
            where: {
              fromDate: { lte: now },
              OR: [{ toDate: null }, { toDate: { gte: now } }],
            },
            orderBy: { fromDate: "desc" },
            take: 1,
            select: {
              fromDate: true,
            },
          },
        },
      },
    },
    orderBy: {
      dueDate: "asc",
    },
    take: 100,
  });

  return ok(
    checkSheets
      .map((sheet) => {
        const isIssued = sheet.issuedAt !== null && sheet.completedAt === null;
        const status = isIssued ? CheckStatus.ISSUED : sheet.status;

        if (status === CheckStatus.ISSUED || status === CheckStatus.COMPLETED) {
          return {
            id: sheet.id,
            equipmentId: sheet.equipmentId,
            equipmentNumber: sheet.equipment.equipmentNumber,
            equipmentName: sheet.equipment.displayName,
            usageUnit: sheet.equipment.usageUnit,
            checkCode: sheet.checkCode,
            dueDate: sheet.dueDate.toISOString(),
            dueHours: Number(sheet.dueHours),
            status,
            triggerType: sheet.triggerType,
          };
        }

        const currentHours = Number(sheet.equipment.currentHours);
        const recalculatedStatus = determineStatus(
          Number(sheet.dueHours),
          currentHours,
          sheet.dueDate,
          now,
          thresholds,
        );

        const activeGrounding = sheet.equipment.groundingPeriods[0] ?? null;

        if (activeGrounding && recalculatedStatus !== CheckStatus.ISSUED && recalculatedStatus !== CheckStatus.COMPLETED) {
          const fiveMonthsDate = addMonths(activeGrounding.fromDate, 5);
          if (now < fiveMonthsDate) {
            return null;
          }
        }

        return {
          id: sheet.id,
          equipmentId: sheet.equipmentId,
          equipmentNumber: sheet.equipment.equipmentNumber,
          equipmentName: sheet.equipment.displayName,
          usageUnit: sheet.equipment.usageUnit,
          checkCode: sheet.checkCode,
          dueDate: sheet.dueDate.toISOString(),
          dueHours: Number(sheet.dueHours),
          status: recalculatedStatus,
          triggerType: sheet.triggerType,
        };
      })
      .filter((item) => item !== null),
  );
}
