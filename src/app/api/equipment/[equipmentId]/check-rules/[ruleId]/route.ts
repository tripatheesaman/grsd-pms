import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const updateCheckRuleSchema = z
  .object({
    intervalHours: z.number().int().positive().optional(),
    intervalTimeValue: z.number().int().positive().optional().nullable(),
    intervalTimeUnit: z.enum(["MONTHS", "YEARS"]).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (!data.intervalTimeValue && !data.intervalTimeUnit) ||
      (data.intervalTimeValue && data.intervalTimeUnit),
    {
      message: "Both intervalTimeValue and intervalTimeUnit are required when configuring a time interval",
      path: ["intervalTimeValue"],
    },
  );

type RouteContext = {
  params: Promise<{ equipmentId: string; ruleId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateCheckRuleSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId, ruleId } = await context.params;
  const existing = await prisma.checkRule.findFirst({
    where: {
      id: ruleId,
      equipmentId,
    },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Check rule not found", 404);
  }

  const updateData: any = {};
  if (parsed.data.intervalHours !== undefined) updateData.intervalHours = parsed.data.intervalHours;
  if (parsed.data.intervalTimeValue !== undefined) updateData.intervalTimeValue = parsed.data.intervalTimeValue;
  if (parsed.data.intervalTimeUnit !== undefined) updateData.intervalTimeUnit = parsed.data.intervalTimeUnit;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const updated = await prisma.checkRule.update({
    where: { id: ruleId },
    data: updateData,
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "checkRule.update",
    entityType: "CheckRule",
    entityId: ruleId,
    payload: updateData,
    request,
  });

  return ok({
    id: updated.id,
    code: updated.code,
    intervalHours: updated.intervalHours,
    approachingOffsetHours: updated.approachingOffsetHours,
    issueOffsetHours: updated.issueOffsetHours,
    nearOffsetHours: updated.nearOffsetHours,
    isActive: updated.isActive,
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

  const { equipmentId, ruleId } = await context.params;
  const existing = await prisma.checkRule.findFirst({
    where: {
      id: ruleId,
      equipmentId,
    },
  });

  if (!existing) {
    return fail("NOT_FOUND", "Check rule not found", 404);
  }

  await prisma.checkRule.delete({
    where: { id: ruleId },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "checkRule.delete",
    entityType: "CheckRule",
    entityId: ruleId,
    payload: {
      equipmentId,
      code: existing.code,
    },
    request: _,
  });

  return ok({ id: ruleId });
}
