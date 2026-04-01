import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { ensureImpliedCompletedChecks } from "@/lib/planning/baseline-completions";

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
  previousCheckCode: z.string().regex(/^[A-Z]$/).optional().nullable(),
  previousCheckDate: z.string().optional().nullable(),
  previousCheckHours: z.number().nonnegative().optional().nullable(),
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

  const latestCompleted = (equipment.checkSheets ?? [])
    .filter((sheet: any) => sheet.status === "COMPLETED")
    .sort((a: any, b: any) => {
      const aTime = new Date(a.completedAt ?? a.dueDate).getTime();
      const bTime = new Date(b.completedAt ?? b.dueDate).getTime();
      if (aTime !== bTime) return bTime - aTime;
      return Number(b.completedHours ?? b.dueHours ?? 0) - Number(a.completedHours ?? a.dueHours ?? 0);
    })[0] ?? null;

  const latestCompletedAt = latestCompleted ? new Date(latestCompleted.completedAt ?? latestCompleted.dueDate) : null;
  const latestCompletedHours = latestCompleted ? Number(latestCompleted.completedHours ?? latestCompleted.dueHours ?? 0) : null;
  const visibleSheets = (equipment.checkSheets ?? []).filter((sheet: any) => {
    if (sheet.status !== "COMPLETED") return true;
    if (!latestCompletedAt || latestCompletedHours == null || !sheet.completedAt) return true;
    const sameCompletionDay = new Date(sheet.completedAt).getTime() === latestCompletedAt.getTime();
    if (!sameCompletionDay) return true;
    return Number(sheet.dueHours) >= latestCompletedHours;
  });

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
    previousCheckCode: latestCompleted?.checkCode ?? null,
    previousCheckDate: latestCompleted ? new Date(latestCompleted.completedAt ?? latestCompleted.dueDate).toISOString().slice(0, 10) : null,
    previousCheckHours: latestCompleted ? Number(latestCompleted.completedHours ?? latestCompleted.dueHours) : null,
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
      isOneTime: rule.isOneTime,
    })),
    checkSheets: visibleSheets.map((sheet: any) => ({
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

  const baselineTouched =
    parsed.data.previousCheckCode !== undefined ||
    parsed.data.previousCheckDate !== undefined ||
    parsed.data.previousCheckHours !== undefined;
  if (baselineTouched) {
    const code = parsed.data.previousCheckCode ?? null;
    const dateRaw = parsed.data.previousCheckDate ?? null;
    const hours = parsed.data.previousCheckHours ?? null;
    const clearAll = code === null && dateRaw === null && hours === null;
    if (!clearAll) {
      if (!code || !dateRaw || hours == null) {
        return fail("BAD_REQUEST", "Previous check code, date, and hours must all be provided together", 400);
      }
      const date = new Date(`${dateRaw}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime())) {
        return fail("BAD_REQUEST", "previousCheckDate must be YYYY-MM-DD", 400);
      }
      const match = await prisma.checkRule.findFirst({
        where: { equipmentId, code },
        select: { id: true, code: true },
      });
      if (!match) {
        return fail("BAD_REQUEST", "Previous check code must match one of the check rules", 400);
      }
      updateData.planningBaselineCheckCode = code;
      updateData.planningBaselineCheckDate = date;
      updateData.planningBaselineHours = hours;
    } else {
      updateData.planningBaselineCheckCode = null;
      updateData.planningBaselineCheckDate = null;
      updateData.planningBaselineHours = null;
    }
  }

  const updated = await prisma.equipment.update({
    where: { id: equipmentId },
    data: updateData,
  });

  if (baselineTouched && updated.planningBaselineCheckCode && updated.planningBaselineCheckDate && updated.planningBaselineHours != null) {
    const match = await prisma.checkRule.findFirst({
      where: { equipmentId, code: updated.planningBaselineCheckCode },
      select: { id: true, code: true },
    });
    if (match) {
      const existing = await prisma.checkSheet.findFirst({
        where: {
          equipmentId,
          checkCode: match.code,
          dueHours: Number(updated.planningBaselineHours),
        },
        select: { id: true },
      });
      if (existing) {
        await prisma.checkSheet.update({
          where: { id: existing.id },
          data: {
            checkRuleId: match.id,
            dueDate: updated.planningBaselineCheckDate,
            triggerType: "HOURS",
            status: "COMPLETED",
            completedAt: updated.planningBaselineCheckDate,
            completedHours: Number(updated.planningBaselineHours),
            issuedAt: null,
            remarks: null,
          },
        });
      } else {
        await prisma.checkSheet.create({
          data: {
            equipmentId,
            checkRuleId: match.id,
            checkCode: match.code,
            dueHours: Number(updated.planningBaselineHours),
            dueDate: updated.planningBaselineCheckDate,
            triggerType: "HOURS",
            status: "COMPLETED",
            completedAt: updated.planningBaselineCheckDate,
            completedHours: Number(updated.planningBaselineHours),
          },
        });
      }
      await ensureImpliedCompletedChecks({
        equipmentId,
        baselineHours: Number(updated.planningBaselineHours),
        baselineDate: updated.planningBaselineCheckDate,
      }).catch(() => null);
    }
  }

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
