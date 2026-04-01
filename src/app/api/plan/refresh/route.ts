import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { recalculateEquipmentUsage } from "@/lib/planning/recalculate-usage";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { permissionKeys } from "@/lib/security/permissions";

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const yearRaw = url.searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid year" } }, { status: 400 });
  }

  const equipments = await prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { equipmentNumber: "asc" },
  });

  const batchSize = 30;
  for (let i = 0; i < equipments.length; i += batchSize) {
    const batch = equipments.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (e) => {
        await recalculateEquipmentUsage(e.id);
        await syncEquipmentPlan(e.id, year);
      }),
    );
  }

  return ok({ year, equipmentCount: equipments.length });
}

