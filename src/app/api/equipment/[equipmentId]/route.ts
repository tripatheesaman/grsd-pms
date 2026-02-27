import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

import { UsageUnit } from "@prisma/client";

const updateEquipmentSchema = z.object({
  equipmentNumber: z.string().min(1).max(40).optional(),
  displayName: z.string().min(2).max(120).optional(),
  equipmentClass: z.string().min(2).max(40).optional(),
  averageHoursPerDay: z.number().nonnegative().optional(),
  currentHours: z.number().nonnegative().optional(),
  commissionedAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  usageUnit: z.nativeEnum(UsageUnit).optional(),
});

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await (prisma as any).equipment.findUnique({
    where: { id: equipmentId },
    include: {
      checkRules: {
        orderBy: { code: "asc" },
      },
      checkSheets: {
        orderBy: { dueDate: "desc" },
        take: 100,
      },
      groundingPeriods: {
        orderBy: { fromDate: "desc" },
      },
    },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  return ok({
    id: equipment.id,
    equipmentNumber: equipment.equipmentNumber,
    displayName: equipment.displayName,
    equipmentClass: equipment.equipmentClass,
    averageHoursPerDay: Number(equipment.averageHoursPerDay),
    currentHours: Number(equipment.currentHours),
    commissionedAt: equipment.commissionedAt?.toISOString() ?? null,
    isActive: equipment.isActive,
    usageUnit: equipment.usageUnit,
    checkRules: equipment.checkRules.map((rule: any) => ({
      id: rule.id,
      code: rule.code,
      intervalHours: rule.intervalHours,
      approachingOffsetHours: rule.approachingOffsetHours,
      issueOffsetHours: rule.issueOffsetHours,
      nearOffsetHours: rule.nearOffsetHours,
      intervalTimeValue: rule.intervalTimeValue,
      intervalTimeUnit: rule.intervalTimeUnit,
      isActive: rule.isActive,
    })),
    checkSheets: equipment.checkSheets.map((sheet: any) => ({
      id: sheet.id,
      checkCode: sheet.checkCode,
      dueHours: Number(sheet.dueHours),
      dueDate: sheet.dueDate.toISOString(),
      triggerType: sheet.triggerType,
      status: sheet.status,
      issuedAt: sheet.issuedAt?.toISOString() ?? null,
      completedAt: sheet.completedAt?.toISOString() ?? null,
      pdfFilePath: sheet.pdfFilePath ?? null,
    })),
    groundingPeriods: equipment.groundingPeriods.map((period: any) => ({
      id: period.id,
      fromDate: period.fromDate.toISOString(),
      toDate: period.toDate ? period.toDate.toISOString() : null,
      reason: period.reason,
    })),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateEquipmentSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId } = await context.params;
  const existing = await prisma.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  if (parsed.data.equipmentNumber && parsed.data.equipmentNumber !== existing.equipmentNumber) {
    const duplicate = await prisma.equipment.findUnique({
      where: { equipmentNumber: parsed.data.equipmentNumber },
    });
    if (duplicate) {
      return fail("CONFLICT", "Equipment number already exists", 409);
    }
  }

  const updateData: any = {};
  if (parsed.data.equipmentNumber !== undefined) updateData.equipmentNumber = parsed.data.equipmentNumber;
  if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
  if (parsed.data.equipmentClass !== undefined) updateData.equipmentClass = parsed.data.equipmentClass;
  if (parsed.data.averageHoursPerDay !== undefined) updateData.averageHoursPerDay = parsed.data.averageHoursPerDay;
  if (parsed.data.currentHours !== undefined) updateData.currentHours = parsed.data.currentHours;
  if (parsed.data.commissionedAt !== undefined) {
    updateData.commissionedAt = parsed.data.commissionedAt ? new Date(parsed.data.commissionedAt) : null;
  }
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.usageUnit !== undefined) updateData.usageUnit = parsed.data.usageUnit;

  const updated = await prisma.equipment.update({
    where: { id: equipmentId },
    data: updateData,
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.update",
    entityType: "Equipment",
    entityId: equipmentId,
    payload: updateData,
    request,
  });

  return ok({
    id: updated.id,
    equipmentNumber: updated.equipmentNumber,
    displayName: updated.displayName,
  });
}

export async function DELETE(_: Request, context: RouteContext) {
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
  });

  if (!existing) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  await prisma.equipment.delete({
    where: { id: equipmentId },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.delete",
    entityType: "Equipment",
    entityId: equipmentId,
    payload: {
      equipmentNumber: existing.equipmentNumber,
      displayName: existing.displayName,
    },
    request: _,
  });

  return ok({ id: equipmentId });
}
