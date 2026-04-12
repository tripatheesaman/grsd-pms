import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { EntryStatus } from "@prisma/client";

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function POST(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const existing = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, equipmentNumber: true, meterSegment: true },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const updated = await prisma.equipment.update({
    where: { id: equipmentId },
    data: { meterSegment: { increment: 1 } },
    select: { meterSegment: true },
  });

  await prisma.dailyEntry.updateMany({
    where: { equipmentId, status: EntryStatus.PENDING },
    data: { meterSegment: updated.meterSegment },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.meter.reset",
    entityType: "Equipment",
    entityId: equipmentId,
    payload: {
      equipmentNumber: existing.equipmentNumber,
      previousMeterSegment: existing.meterSegment,
      meterSegment: updated.meterSegment,
    },
    request: _,
  });

  return ok({ meterSegment: updated.meterSegment });
}
