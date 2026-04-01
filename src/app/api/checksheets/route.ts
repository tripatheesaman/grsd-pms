import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { determineStatus } from "@/lib/planning/engine";
import { getSystemThresholds } from "@/lib/planning/thresholds";

function addMonths(date: Date, months: number) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
}

const ALERT_START_DATE = new Date("2026-04-01T00:00:00.000Z");

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.checksheetRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const thresholds = await getSystemThresholds();
  const now = new Date();
  const requestUrl = new URL(request.url);
  const searchParams = requestUrl.searchParams;
  const paginated = searchParams.get("paginated") === "true";
  const openOnly = searchParams.get("openOnly") === "true";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? 20) || 20));
  const statusFilter = searchParams.get("status");
  const equipmentSearch = searchParams.get("equipmentSearch")?.trim().toLowerCase() ?? "";
  const checkCodeFilter = searchParams.get("checkCode")?.trim().toUpperCase() ?? "";
  const triggerTypeFilter = searchParams.get("triggerType");
  const dateFromFilter = searchParams.get("dateFrom");
  const dateToFilter = searchParams.get("dateTo");

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
      dueDate: {
        gte: ALERT_START_DATE,
      },
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
          displayName: true,
          currentHours: true,
          usageUnit: true,
          checkSheets: {
            where: { status: CheckStatus.COMPLETED },
            orderBy: [{ completedAt: "desc" }, { dueDate: "desc" }],
            take: 1,
            select: {
              completedAt: true,
              dueDate: true,
            },
          },
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
    take: 500,
  });

  const mapped = checkSheets
    .map((sheet) => {
        const latestCompleted = sheet.equipment.checkSheets[0] ?? null;
        const latestCompletedAt = latestCompleted?.completedAt ?? latestCompleted?.dueDate ?? null;
        if (latestCompletedAt && sheet.dueDate <= latestCompletedAt) {
          return null;
        }

        const currentHours = Number(sheet.equipment.currentHours);
        const dueHours = Number(sheet.dueHours);
        const isHourReached = currentHours >= dueHours;
        const effectiveDueDate = isHourReached && sheet.dueDate > now ? now : sheet.dueDate;
        const recalculatedStatus = determineStatus(
          dueHours,
          currentHours,
          effectiveDueDate,
          now,
          thresholds,
        );
        const isIssued = sheet.issuedAt !== null && sheet.completedAt === null;
        const effectiveStatus =
          sheet.status === CheckStatus.COMPLETED
            ? CheckStatus.COMPLETED
            : isIssued
              ? CheckStatus.ISSUED
              : recalculatedStatus;

        const activeGrounding = sheet.equipment.groundingPeriods[0] ?? null;

        if (activeGrounding) {
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
          dueDate: effectiveDueDate.toISOString(),
          dueHours,
          status: effectiveStatus,
          triggerType: sheet.triggerType,
        };
      })
      .filter((item) => item !== null);

  const filtered = mapped.filter((sheet) => {
    if (!sheet) return false;
    if (openOnly && (sheet.status === CheckStatus.ISSUED || sheet.status === CheckStatus.COMPLETED)) {
      return false;
    }
    if (statusFilter && statusFilter !== "ALL" && sheet.status !== statusFilter) {
      return false;
    }
    if (equipmentSearch) {
      const eqNumber = sheet.equipmentNumber.toLowerCase();
      const eqName = sheet.equipmentName.toLowerCase();
      if (!eqNumber.includes(equipmentSearch) && !eqName.includes(equipmentSearch)) {
        return false;
      }
    }
    if (checkCodeFilter && sheet.checkCode.toUpperCase() !== checkCodeFilter) {
      return false;
    }
    if (triggerTypeFilter && triggerTypeFilter !== "ALL" && sheet.triggerType !== triggerTypeFilter) {
      return false;
    }
    if (dateFromFilter) {
      const from = new Date(dateFromFilter);
      if (new Date(sheet.dueDate) < from) {
        return false;
      }
    }
    if (dateToFilter) {
      const to = new Date(dateToFilter);
      to.setHours(23, 59, 59, 999);
      if (new Date(sheet.dueDate) > to) {
        return false;
      }
    }
    return true;
  });

  filtered.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (!paginated) {
    return ok(filtered);
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return ok({
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  });
}
