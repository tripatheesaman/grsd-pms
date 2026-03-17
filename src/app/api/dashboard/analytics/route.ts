import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const STATUS_START_DATE = new Date("2026-04-01T00:00:00.000Z");

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.dashboardRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const soon = new Date();
  soon.setDate(soon.getDate() + 14);

  const [equipmentCount, activeAlerts, todayEntries, checksDueSoon, unreadNotifications, overdueEscalations] = await Promise.all([
    prisma.equipment.count({ where: { isActive: true } }),
    prisma.alert.count({
      where: {
        acknowledged: false,
        createdAt: {
          gte: STATUS_START_DATE,
        },
      },
    }),
    prisma.dailyEntry.count({
      where: {
        entryDate: {
          gte: start,
          lt: end,
        },
      },
    }),
    prisma.checkSheet.count({
      where: {
        status: {
          in: [CheckStatus.PREDICTED, CheckStatus.ISSUE_REQUIRED, CheckStatus.NEAR_DUE],
        },
        dueDate: {
          lte: soon,
          gte: STATUS_START_DATE,
        },
      },
    }),
    prisma.notification.count({
      where: {
        OR: [{ userId: access.user.id }, { userId: null }],
        status: {
          not: "READ",
        },
        createdAt: {
          gte: STATUS_START_DATE,
        },
      },
    }),
    prisma.checkSheet.count({
      where: {
        status: CheckStatus.OVERDUE,
        dueDate: {
          gte: STATUS_START_DATE,
        },
      },
    }),
  ]);

  return ok({
    equipmentCount,
    activeAlerts,
    todayEntries,
    checksDueSoon,
    unreadNotifications,
    overdueEscalations,
  });
}
