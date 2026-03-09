import { unlink, readFile } from "fs/promises";
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
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const checkSheet = await prisma.checkSheet.findUnique({
    where: { id: checkSheetId },
    include: {
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
  });

  if (!checkSheet) {
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

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return fail("BAD_REQUEST", "File size must be less than 10MB", 400);
  }

  const fileName = `${checkSheet.equipment.equipmentNumber}_${checkSheet.checkCode}_${checkSheetId}.pdf`;
  const filePath = buildUploadPath("checksheets", fileName);

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await writeFileAtomic(filePath, buffer);

    const relativePath = `checksheets/${fileName}`;

    await prisma.checkSheet.update({
      where: { id: checkSheetId },
      data: { pdfFilePath: relativePath },
    });

    await writeAuditLog({
      userId: access.user.id,
      action: "checksheet.uploadPdf",
      entityType: "CheckSheet",
      entityId: checkSheetId,
      payload: {
        fileName,
        fileSize: file.size,
      },
      request,
    });

    return ok({ filePath: `${UPLOADS_BASE_URL}/${relativePath}` });
  } catch (error) {
    console.error("Error uploading file:", error);
    return fail("INTERNAL_ERROR", "Failed to upload file", 500);
  }
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
  const checkSheet = await prisma.checkSheet.findUnique({
    where: { id: checkSheetId },
    select: {
      pdfFilePath: true,
    },
  });

  if (!checkSheet || !checkSheet.pdfFilePath) {
    return fail("NOT_FOUND", "PDF file not found", 404);
  }

  try {
    const relative = checkSheet.pdfFilePath.replace(/^\/+/, "");
    const filePath = buildUploadPath(...relative.split("/"));
    const fileBuffer = await readFile(filePath);

    const response = new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${checkSheet.pdfFilePath.split("/").pop()}"`,
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
    return response;
  } catch (error) {
    console.error("Error reading file:", error);
    return fail("INTERNAL_ERROR", "Failed to read file", 500);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const { checkSheetId } = await context.params;
  const checkSheet = await prisma.checkSheet.findUnique({
    where: { id: checkSheetId },
    select: {
      pdfFilePath: true,
    },
  });

  if (!checkSheet || !checkSheet.pdfFilePath) {
    return fail("NOT_FOUND", "PDF file not found", 404);
  }

  try {
    const relative = checkSheet.pdfFilePath.replace(/^\/+/, "");
    const filePath = buildUploadPath(...relative.split("/"));
    await unlink(filePath);

    await prisma.checkSheet.update({
      where: { id: checkSheetId },
      data: { pdfFilePath: null },
    });

    await writeAuditLog({
      userId: access.user.id,
      action: "checksheet.deletePdf",
      entityType: "CheckSheet",
      entityId: checkSheetId,
      request: _,
    });

    return ok({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return fail("INTERNAL_ERROR", "Failed to delete file", 500);
  }
}
