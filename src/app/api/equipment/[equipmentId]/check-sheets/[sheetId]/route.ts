import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { CheckStatus, TriggerType } from "@prisma/client";

const updateCheckSheetSchema = z.object({
  checkCode: z.string().min(1).max(1).regex(/^[A-Z]$/).optional(),
  dueHours: z.number().nonnegative().optional(),
  dueDate: z.string().datetime().optional(),
  triggerType: z.enum(["HOURS", "CALENDAR"]).optional(),
  status: z.enum(["PREDICTED", "ISSUE_REQUIRED", "NEAR_DUE", "ISSUED", "COMPLETED", "OVERDUE"]).optional(),
  issuedAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});

type RouteContext = {
  params: Promise<{ equipmentId: string; sheetId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateCheckSheetSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId, sheetId } = await context.params;
  const existing = await prisma.checkSheet.findFirst({
    where: {
      id: sheetId,
      equipmentId,
    },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Check sheet not found", 404);
  }

  const updateData: any = {};
  if (parsed.data.checkCode !== undefined) updateData.checkCode = parsed.data.checkCode;
  if (parsed.data.dueHours !== undefined) updateData.dueHours = parsed.data.dueHours;
  if (parsed.data.dueDate !== undefined) updateData.dueDate = new Date(parsed.data.dueDate);
  if (parsed.data.triggerType !== undefined) updateData.triggerType = parsed.data.triggerType as TriggerType;
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status as CheckStatus;
  if (parsed.data.issuedAt !== undefined) {
    updateData.issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : null;
  }
  if (parsed.data.completedAt !== undefined) {
    updateData.completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : null;
  }

  const updated = await prisma.checkSheet.update({
    where: { id: sheetId },
    data: updateData,
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "checkSheet.update",
    entityType: "CheckSheet",
    entityId: sheetId,
    payload: updateData,
    request,
  });

  return ok({
    id: updated.id,
    checkCode: updated.checkCode,
    dueHours: Number(updated.dueHours),
    dueDate: updated.dueDate.toISOString(),
    triggerType: updated.triggerType,
    status: updated.status,
    issuedAt: updated.issuedAt?.toISOString() ?? null,
    completedAt: updated.completedAt?.toISOString() ?? null,
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

  const { equipmentId, sheetId } = await context.params;
  const existing = await prisma.checkSheet.findFirst({
    where: {
      id: sheetId,
      equipmentId,
    },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Check sheet not found", 404);
  }

  await prisma.checkSheet.delete({
    where: { id: sheetId },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "checkSheet.delete",
    entityType: "CheckSheet",
    entityId: sheetId,
    payload: {
      equipmentId,
      checkCode: existing.checkCode,
    },
    request: _,
  });

  return ok({ id: sheetId });
}
