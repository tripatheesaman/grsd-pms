import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.alertsRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const alerts = await prisma.alert.findMany({
    where: {
      acknowledged: false,
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
          displayName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return ok(
    alerts.map((alert) => ({
      id: alert.id,
      level: alert.level,
      message: alert.message,
      createdAt: alert.createdAt.toISOString(),
      equipmentNumber: alert.equipment.equipmentNumber,
      equipmentName: alert.equipment.displayName,
    })),
  );
}
