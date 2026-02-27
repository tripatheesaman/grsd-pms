import { unlink, readFile, access as fsAccess } from "fs/promises";
import { constants } from "fs";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { buildUploadPath, writeFileAtomic } from "@/lib/uploads";
import { UPLOADS_BASE_URL } from "@/lib/config/app-config";

type RouteContext = {
  params: Promise<{ checkSheetId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.checksheetComplete,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const sheet = await prisma.checkSheet.findUnique({
    where: { id: checkSheetId },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
  });

  if (!sheet) {
    return fail("NOT_FOUND", "Check sheet not found", 404);
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

  const fileName = `${checkSheetId}.pdf`;
  const absolutePath = buildUploadPath("checksheets", "completed", fileName);

  const bytes = await file.arrayBuffer();
  await writeFileAtomic(absolutePath, Buffer.from(bytes));

  await writeAuditLog({
    userId: access.user.id,
    action: "checksheet.completedPdf.upload",
    entityType: "CheckSheet",
    entityId: checkSheetId,
    payload: {
      equipmentNumber: sheet.equipment.equipmentNumber,
      checkCode: sheet.checkCode,
      fileName,
      fileSize: file.size,
    },
    request,
  });

  return ok({ filePath: `${UPLOADS_BASE_URL}/checksheets/completed/${fileName}` });
}

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.checksheetRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const fileName = `${checkSheetId}.pdf`;
  const absolutePath = buildUploadPath("checksheets", "completed", fileName);

  try {
    await fsAccess(absolutePath, constants.F_OK);
  } catch {
    return fail("NOT_FOUND", "Completed reference document not found", 404);
  }

  const buffer = await readFile(absolutePath);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.checksheetComplete,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const fileName = `${checkSheetId}.pdf`;
  const absolutePath = buildUploadPath("checksheets", "completed", fileName);

  try {
    await fsAccess(absolutePath, constants.F_OK);
  } catch {
    return fail("NOT_FOUND", "Completed reference document not found", 404);
  }

  await unlink(absolutePath);

  await writeAuditLog({
    userId: access.user.id,
    action: "checksheet.completedPdf.delete",
    entityType: "CheckSheet",
    entityId: checkSheetId,
    payload: {
      fileName,
    },
    request,
  });

  return ok({ success: true });
}
