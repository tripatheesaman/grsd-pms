import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { UPLOADS_BASE_URL } from "@/lib/config/app-config";

export async function GET() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const checkSheets = await prisma.checkSheet.findMany({
    include: {
      equipment: {
        select: {
          id: true,
          equipmentNumber: true,
          displayName: true,
          usageUnit: true,
          checkSheets: {
            where: { status: "COMPLETED" as any },
            orderBy: [{ completedAt: "desc" }, { dueHours: "desc" }],
            take: 1,
            select: {
              completedAt: true,
              dueDate: true,
              completedHours: true,
              dueHours: true,
            },
          },
        },
      },
    },
    orderBy: {
      dueDate: "desc",
    },
    take: 1000,
  });

  return ok(
    checkSheets
      .filter((sheet) => {
        const cutoff = sheet.equipment.checkSheets[0] ?? null;
        if (sheet.status !== "COMPLETED" || !cutoff) return true;
        const cutoffAt = cutoff.completedAt ?? cutoff.dueDate;
        if (!cutoffAt || !sheet.completedAt) return true;
        if (sheet.completedAt.getTime() !== cutoffAt.getTime()) return true;
        const cutoffHours = Number(cutoff.completedHours ?? cutoff.dueHours ?? 0);
        return Number(sheet.dueHours) >= cutoffHours;
      })
      .map((sheet) => {
      let pdfFilePath: string | null = null;
      if (sheet.pdfFilePath) {
        const relative = sheet.pdfFilePath.replace(/^\/+/, "").replace(/^uploads\//, "");
        pdfFilePath = `${UPLOADS_BASE_URL}/${relative.startsWith("checksheets/") ? relative : `checksheets/${relative}`}`;
      }

      return {
        id: sheet.id,
        equipmentId: sheet.equipmentId,
        equipmentNumber: sheet.equipment.equipmentNumber,
        equipmentName: sheet.equipment.displayName,
        usageUnit: sheet.equipment.usageUnit,
        checkCode: sheet.checkCode,
        dueHours: Number(sheet.dueHours),
        dueDate: sheet.dueDate.toISOString(),
        triggerType: sheet.triggerType,
        status: sheet.status,
        issuedAt: sheet.issuedAt?.toISOString() ?? null,
        completedAt: sheet.completedAt?.toISOString() ?? null,
        pdfFilePath,
        completedHours: sheet.completedHours !== null ? Number(sheet.completedHours) : null,
      };
      }),
  );
}
