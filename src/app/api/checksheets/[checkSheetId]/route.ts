import { CheckStatus } from "@prisma/client";
import { z } from "zod";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { sendCheckEmail } from "@/lib/email";

const updateSchema = z.object({
  action: z.enum(["issue", "complete"]),
  date: z.string().datetime(),
  completedHours: z.number().nonnegative().optional(),
  remarks: z.string().max(1000).optional(),
  technicianIds: z.array(z.string()).optional(),
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
    include: {
      equipment: true,
    },
  });
  if (!existing) {
    return fail("NOT_FOUND", "Check sheet not found", 404);
  }

  const valueDate = new Date(parsed.data.date);
  
  if (parsed.data.action === "complete") {
    await prisma.$transaction(async (tx) => {
      await tx.checkSheet.update({
        where: {
          id: checkSheetId,
        },
        data: {
          completedAt: valueDate,
          completedHours: parsed.data.completedHours !== undefined ? parsed.data.completedHours : null,
          remarks: parsed.data.remarks || null,
          status: CheckStatus.COMPLETED,
        },
      });

      if (parsed.data.technicianIds && parsed.data.technicianIds.length > 0) {
        await tx.checkSheetTechnician.deleteMany({
          where: { checkSheetId },
        });

        await tx.checkSheetTechnician.createMany({
          data: parsed.data.technicianIds.map((technicianId) => ({
            checkSheetId,
            technicianId,
          })),
        });
      }
    });
  } else {
    const updated = await prisma.checkSheet.update({
      where: {
        id: checkSheetId,
      },
      data: {
        issuedAt: valueDate,
        status: CheckStatus.ISSUED,
      },
    });

    sendCheckEmail({
      type: "issued",
      check: {
        ...updated,
        equipment: existing.equipment,
      },
    }).catch(() => null);
  }

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
      remarks: parsed.data.remarks ?? null,
      technicianIds: parsed.data.technicianIds ?? [],
    },
    request,
  }).catch(() => null);

  return ok({ id: checkSheetId, status: parsed.data.action === "issue" ? "ISSUED" : "COMPLETED" });
}
