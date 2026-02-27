import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

function isoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export async function GET(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.planRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await prisma.equipment.findUnique({
    where: {
      id: equipmentId,
    },
    select: {
      id: true,
    },
  });
  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const url = new URL(request.url);
  const yearRaw = url.searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fail("BAD_REQUEST", "Invalid year", 400);
  }

  await syncEquipmentPlan(equipmentId, year);

  const sheets = await prisma.checkSheet.findMany({
    where: {
      equipmentId,
      dueDate: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59, 999),
      },
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  return ok(
    sheets.map((sheet) => ({
      id: sheet.id,
      week: isoWeek(sheet.dueDate),
      checkCode: sheet.checkCode,
      triggerType: sheet.triggerType,
      dueDate: sheet.dueDate.toISOString(),
      dueHours: Number(sheet.dueHours),
      status: sheet.status,
    })),
  );
}
