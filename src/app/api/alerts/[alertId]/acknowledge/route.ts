import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.alertsAcknowledge,
  });
  if ("error" in access) {
    return access.error;
  }

  const { alertId } = await context.params;
  const alert = await prisma.alert.findUnique({
    where: {
      id: alertId,
    },
    select: {
      id: true,
      acknowledged: true,
    },
  });
  if (!alert) {
    return fail("NOT_FOUND", "Alert not found", 404);
  }

  if (!alert.acknowledged) {
    await prisma.alert.update({
      where: {
        id: alertId,
      },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
      },
    });
  }

  await writeAuditLog({
    userId: access.user.id,
    action: "alert.acknowledge",
    entityType: "Alert",
    entityId: alertId,
    request,
  });

  return ok({ id: alertId, acknowledged: true });
}
