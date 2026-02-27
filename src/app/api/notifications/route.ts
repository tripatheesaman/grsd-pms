import { NotificationStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.notificationsRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: access.user.id }, { userId: null }],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return ok(
    notifications.map((notification) => ({
      id: notification.id,
      channel: notification.channel,
      status: notification.status,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt.toISOString(),
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      isUnread: notification.status !== NotificationStatus.READ,
    })),
  );
}
