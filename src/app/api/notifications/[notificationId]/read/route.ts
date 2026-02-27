import { NotificationStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.notificationsManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { notificationId } = await context.params;
  const notification = await prisma.notification.findUnique({
    where: {
      id: notificationId,
    },
    select: {
      id: true,
      userId: true,
    },
  });
  if (!notification) {
    return fail("NOT_FOUND", "Notification not found", 404);
  }

  if (notification.userId && notification.userId !== access.user.id) {
    return fail("FORBIDDEN", "Not allowed", 403);
  }

  await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      status: NotificationStatus.READ,
      readAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "notification.read",
    entityType: "Notification",
    entityId: notificationId,
    request,
  });

  return ok({ id: notificationId, status: "READ" });
}
