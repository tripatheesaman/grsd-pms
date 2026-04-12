import { z } from "zod";
import { EntryStatus } from "@prisma/client";
import { parseBody, requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { minimumReadingForDailyEntry } from "@/lib/entries/reading-floor";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { recalculateEquipmentUsage } from "@/lib/planning/recalculate-usage";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

const updateEntrySchema = z.object({
  entryDate: z.string().datetime().optional(),
  hoursRun: z.number().positive().optional(),
});

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, updateEntrySchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { entryId } = await context.params;

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      equipment: true,
    },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }


  const updateData: {
    entryDate?: Date;
    hoursRun?: number;
  } = {};

  if (parsed.data.entryDate) {
    const entryDate = new Date(parsed.data.entryDate);
    const day = new Date(entryDate);
    day.setHours(0, 0, 0, 0);
    updateData.entryDate = day;
  }

  if (parsed.data.hoursRun !== undefined) {
    const effectiveDate = updateData.entryDate || entry.entryDate;
    const minReading = await minimumReadingForDailyEntry(prisma, {
      equipmentId: entry.equipmentId,
      meterSegment: entry.meterSegment,
      beforeEntryDate: effectiveDate,
      equipmentCurrentHours: Number(entry.equipment.currentHours),
      excludeEntryId: entry.status === EntryStatus.APPROVED ? entry.id : undefined,
    });

    if (parsed.data.hoursRun < minReading) {
      return fail("BAD_REQUEST", `Hours must be at least ${minReading.toFixed(2)} (previous entry hours)`, 400);
    }

    updateData.hoursRun = parsed.data.hoursRun;
  }

  const updatedEntry = await prisma.dailyEntry.update({
    where: { id: entryId },
    data: updateData,
  });

  await recalculateEquipmentUsage(entry.equipmentId);
  await syncEquipmentPlan(entry.equipmentId, new Date().getFullYear());

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.update",
    entityType: "DailyEntry",
    entityId: entryId,
    payload: {
      ...updateData,
      hoursRun: updateData.hoursRun ? Number(updateData.hoursRun) : undefined,
    },
    request,
  });

  return ok({
    id: updatedEntry.id,
    entryDate: updatedEntry.entryDate.toISOString(),
    hoursRun: Number(updatedEntry.hoursRun),
    status: updatedEntry.status,
  });
}

export async function DELETE(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const { entryId } = await context.params;

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }


  await prisma.dailyEntry.delete({
    where: { id: entryId },
  });

  await recalculateEquipmentUsage(entry.equipmentId);
  await syncEquipmentPlan(entry.equipmentId, new Date().getFullYear());

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.delete",
    entityType: "DailyEntry",
    entityId: entryId,
    payload: {
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
    },
    request: _,
  });

  return ok({ success: true });
}
