import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

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
    prisma.alert.count({ where: { acknowledged: false } }),
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
        },
      },
    }),
    prisma.notification.count({
      where: {
        OR: [{ userId: access.user.id }, { userId: null }],
        status: {
          not: "READ",
        },
      },
    }),
    prisma.checkSheet.count({
      where: {
        status: CheckStatus.OVERDUE,
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
