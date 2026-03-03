import { CheckStatus } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const updateSchema = z.object({
  action: z.enum(["issue", "complete"]),
  date: z.string().datetime(),
  completedHours: z.number().nonnegative().optional(),
});

type RouteContext = {
  params: Promise<{ checkSheetId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = await parseBody(request, updateSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const access = await requireAccess({
    minRole: "USER",
    requiredPermission:
      parsed.data.action === "issue"
        ? permissionKeys.checksheetIssue
        : permissionKeys.checksheetComplete,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const existing = await prisma.checkSheet.findUnique({
    where: {
      id: checkSheetId,
    },
    select: {
      id: true,
      equipmentId: true,
      status: true,
    },
  });
  if (!existing) {
    return fail("NOT_FOUND", "Check sheet not found", 404);
  }

  const valueDate = new Date(parsed.data.date);
  
  await prisma.checkSheet.update({
    where: {
      id: checkSheetId,
    },
    data:
      parsed.data.action === "issue"
        ? {
            issuedAt: valueDate,
            status: CheckStatus.ISSUED,
          }
        : {
            completedAt: valueDate,
            completedHours: parsed.data.completedHours !== undefined ? parsed.data.completedHours : null,
            status: CheckStatus.COMPLETED,
          },
  });

  syncEquipmentPlan(existing.equipmentId, new Date().getFullYear()).catch(() => null);

  writeAuditLog({
    userId: access.user.id,
    action: `checksheet.${parsed.data.action}`,
    entityType: "CheckSheet",
    entityId: checkSheetId,
    payload: {
      action: parsed.data.action,
      date: valueDate.toISOString(),
      completedHours: parsed.data.completedHours ?? null,
    },
    request,
  }).catch(() => null);

  return ok({ id: checkSheetId, status: parsed.data.action === "issue" ? "ISSUED" : "COMPLETED" });
}
