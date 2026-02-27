import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET() {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const pendingEntries = await prisma.dailyEntry.findMany({
    where: {
      status: EntryStatus.PENDING,
    },
    include: {
      equipment: {
        select: {
          id: true,
          equipmentNumber: true,
          displayName: true,
          currentHours: true,
          usageUnit: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const entriesWithPrevious = await Promise.all(
    pendingEntries.map(async (entry) => {
      const previousEntry = await prisma.dailyEntry.findFirst({
        where: {
          equipmentId: entry.equipmentId,
          status: EntryStatus.APPROVED,
          entryDate: {
            lt: entry.entryDate,
          },
        },
        orderBy: {
          entryDate: "desc",
        },
        select: {
          entryDate: true,
          hoursRun: true,
        },
      });

      const hasAnyApprovedEntries = await prisma.dailyEntry.count({
        where: {
          equipmentId: entry.equipmentId,
          status: EntryStatus.APPROVED,
        },
      }) > 0;

      const previousHours = previousEntry
        ? Number(previousEntry.hoursRun)
        : hasAnyApprovedEntries
          ? 0
          : Number(entry.equipment.currentHours);

      return {
        id: entry.id,
        equipmentId: entry.equipmentId,
        equipmentNumber: entry.equipment.equipmentNumber,
        equipmentName: entry.equipment.displayName,
        usageUnit: entry.equipment.usageUnit,
        entryDate: entry.entryDate.toISOString(),
        hoursRun: Number(entry.hoursRun),
        status: entry.status,
        createdBy: entry.createdBy.fullName,
        createdByEmail: entry.createdBy.email,
        createdAt: entry.createdAt.toISOString(),
        previousEntryDate: previousEntry?.entryDate.toISOString() || null,
        previousHours: previousHours,
        currentEquipmentHours: Number(entry.equipment.currentHours),
      };
    })
  );

  return ok(entriesWithPrevious);
}
