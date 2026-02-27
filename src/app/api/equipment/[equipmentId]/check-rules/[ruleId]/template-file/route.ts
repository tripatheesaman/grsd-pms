import { unlink, access } from "fs/promises";
import { constants } from "fs";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { buildUploadPath, writeFileAtomic } from "@/lib/uploads";
import { UPLOADS_BASE_URL } from "@/lib/config/app-config";

type RouteContext = {
  params: Promise<{ equipmentId: string; ruleId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const accessControl = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in accessControl) {
    return accessControl.error;
  }

  const { equipmentId, ruleId } = await context.params;
  const rule = await prisma.checkRule.findFirst({
    where: {
      id: ruleId,
      equipmentId,
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
  });

  if (!rule) {
    return fail("NOT_FOUND", "Check rule not found", 404);
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return fail("BAD_REQUEST", "No file provided", 400);
  }
  if (file.type !== "application/pdf") {
    return fail("BAD_REQUEST", "Only PDF files are allowed", 400);
  }
  if (file.size > 10 * 1024 * 1024) {
    return fail("BAD_REQUEST", "File size must be less than 10MB", 400);
  }

  const safeEquipment = rule.equipment.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const safeCode = rule.code.toUpperCase();
  const fileName = `${safeEquipment}_${safeCode}.pdf`;
  const absolutePath = buildUploadPath("checksheets", fileName);

  const bytes = await file.arrayBuffer();
  await writeFileAtomic(absolutePath, Buffer.from(bytes));

  const filePath = `${UPLOADS_BASE_URL}/checksheets/${fileName}`;

  await writeAuditLog({
    userId: accessControl.user.id,
    action: "checkRule.templatePdf.upload",
    entityType: "CheckRule",
    entityId: ruleId,
    payload: {
      equipmentId,
      code: rule.code,
      fileName,
      fileSize: file.size,
    },
    request,
  });

  return ok({ filePath });
}

export async function DELETE(request: Request, context: RouteContext) {
  const accessControl = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in accessControl) {
    return accessControl.error;
  }

  const { equipmentId, ruleId } = await context.params;
  const rule = await prisma.checkRule.findFirst({
    where: {
      id: ruleId,
      equipmentId,
    },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
  });

  if (!rule) {
    return fail("NOT_FOUND", "Check rule not found", 404);
  }

  const safeEquipment = rule.equipment.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const safeCode = rule.code.toUpperCase();
  const fileName = `${safeEquipment}_${safeCode}.pdf`;
  const absolutePath = buildUploadPath("checksheets", fileName);

  try {
    await access(absolutePath, constants.F_OK);
  } catch {
    return fail("NOT_FOUND", "Template PDF not found", 404);
  }

  await unlink(absolutePath);

  await writeAuditLog({
    userId: accessControl.user.id,
    action: "checkRule.templatePdf.delete",
    entityType: "CheckRule",
    entityId: ruleId,
    payload: {
      equipmentId,
      code: rule.code,
      fileName,
    },
    request,
  });

  return ok({ success: true });
}
