import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ technicianId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { technicianId } = await context.params;

  const existing = await prisma.technician.findUnique({
    where: { id: technicianId },
    include: {
      checkSheets: {
        take: 1,
      },
    },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Technician not found", 404);
  }

  if (existing.checkSheets.length > 0) {
    return fail("CONFLICT", "Cannot delete technician with completed checks. Deactivate instead.", 400);
  }

  await prisma.technician.delete({
    where: { id: technicianId },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "technician.delete",
    entityType: "Technician",
    entityId: technicianId,
    payload: {
      name: existing.name,
      staffId: existing.staffId,
    },
    request: _,
  });

  return ok({ success: true });
}
