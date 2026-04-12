import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { minimumReadingForDailyEntry } from "@/lib/entries/reading-floor";
import { recalculateEquipmentUsage } from "@/lib/planning/recalculate-usage";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

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

  const { entryId } = await context.params;

  const entry = await prisma.dailyEntry.findUnique({
    where: { id: entryId },
    include: {
      equipment: {
        select: {
          id: true,
          currentHours: true,
        },
      },
    },
  });

  if (!entry) {
    return fail("NOT_FOUND", "Entry not found", 404);
  }

  if (entry.status !== EntryStatus.PENDING) {
    return fail("BAD_REQUEST", "Entry is not pending approval", 400);
  }

  const minReading = await minimumReadingForDailyEntry(prisma, {
    equipmentId: entry.equipmentId,
    meterSegment: entry.meterSegment,
    beforeEntryDate: entry.entryDate,
    equipmentCurrentHours: Number(entry.equipment.currentHours),
  });

  if (Number(entry.hoursRun) < minReading) {
    return fail(
      "BAD_REQUEST",
      `Hours must be at least ${minReading.toFixed(2)} (previous entry hours)`,
      400,
    );
  }

  // Same (equipmentId, entryDate) may already have APPROVED while this PENDING exists (unique key includes status).
  // Perform conflict removal + promotion atomically so approval cannot leave partial state.
  await prisma.$transaction(async (tx) => {
    await tx.dailyEntry.deleteMany({
      where: {
        equipmentId: entry.equipmentId,
        entryDate: entry.entryDate,
        status: EntryStatus.APPROVED,
      },
    });

    await tx.dailyEntry.update({
      where: { id: entryId },
      data: {
        status: EntryStatus.APPROVED,
        approvedById: access.user.id,
        approvedAt: new Date(),
      },
    });
  });

  const usage = await recalculateEquipmentUsage(entry.equipmentId);
  await syncEquipmentPlan(entry.equipmentId, new Date().getFullYear());

  writeAuditLog({
    userId: access.user.id,
    action: "equipment.entry.approve",
    entityType: "DailyEntry",
    entityId: entryId,
    payload: {
      entryDate: entry.entryDate.toISOString(),
      hoursRun: Number(entry.hoursRun),
      averageHoursPerDay: usage ? Number(usage.averageHoursPerDay.toFixed(2)) : null,
      newCurrentHours: usage ? Number(usage.currentHours.toFixed(2)) : null,
    },
    request,
  }).catch(() => null);

  return ok({
    id: entryId,
    status: EntryStatus.APPROVED,
    averageHoursPerDay: usage ? Number(usage.averageHoursPerDay.toFixed(2)) : 0,
    currentHours: usage ? Number(usage.currentHours.toFixed(2)) : 0,
  });
}
