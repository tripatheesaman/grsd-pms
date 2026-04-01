import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { ensureImpliedCompletedChecks } from "@/lib/planning/baseline-completions";
import { recalculateEquipmentUsage } from "@/lib/planning/recalculate-usage";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { permissionKeys } from "@/lib/security/permissions";

function clampYear(value: number) {
  if (!Number.isInteger(value)) return null;
  if (value < 2000 || value > 2100) return null;
  return value;
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const currentYear = new Date().getFullYear();
  const fromYear = clampYear(Number(url.searchParams.get("fromYear") ?? currentYear - 2)) ?? currentYear - 2;
  const toYear = clampYear(Number(url.searchParams.get("toYear") ?? currentYear)) ?? currentYear;
  const start = Math.min(fromYear, toYear);
  const end = Math.max(fromYear, toYear);

  const years: number[] = [];
  for (let y = start; y <= end; y += 1) {
    if (y >= 2000 && y <= 2100) years.push(y);
  }
  if (years.length === 0) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid year range" } }, { status: 400 });
  }

  const equipments = await prisma.equipment.findMany({
    where: { isActive: true },
    select: { id: true, planningBaselineCheckDate: true, planningBaselineHours: true },
    orderBy: { equipmentNumber: "asc" },
  });

  let impliedCompletedCreated = 0;

  const batchSize = 25;
  for (let i = 0; i < equipments.length; i += batchSize) {
    const batch = equipments.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (e) => {
        let created = 0;
        if (e.planningBaselineCheckDate && e.planningBaselineHours != null) {
          const res = await ensureImpliedCompletedChecks({
            equipmentId: e.id,
            baselineHours: Number(e.planningBaselineHours),
            baselineDate: e.planningBaselineCheckDate,
          }).catch(() => ({ created: 0 }));
          created += res.created;
        }
        await recalculateEquipmentUsage(e.id);
        await Promise.all(years.map((year) => syncEquipmentPlan(e.id, year)));
        return created;
      }),
    );
    impliedCompletedCreated += results.reduce((sum, value) => sum + value, 0);
  }

  return ok({
    equipmentCount: equipments.length,
    years,
    impliedCompletedCreated,
  });
}

