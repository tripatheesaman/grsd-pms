import { EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.entryApprove,
  });
  if ("error" in access) {
    return access.error;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const equipmentId = searchParams.get("equipmentId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: any = {};

  if (status && status !== "ALL") {
    where.status = status as EntryStatus;
  }

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) {
      where.entryDate.gte = new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      where.entryDate.lte = toDate;
    }
  }

  const entries = await prisma.dailyEntry.findMany({
    where,
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
      approvedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      rejectedBy: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      entryDate: "desc",
    },
    take: 1000,
  });

  const entriesWithPrevious = await Promise.all(
    entries.map(async (entry) => {
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
        approvedBy: entry.approvedBy?.fullName || null,
        approvedByEmail: entry.approvedBy?.email || null,
        approvedAt: entry.approvedAt?.toISOString() || null,
        rejectedBy: entry.rejectedBy?.fullName || null,
        rejectedByEmail: entry.rejectedBy?.email || null,
        rejectedAt: entry.rejectedAt?.toISOString() || null,
        previousEntryDate: previousEntry?.entryDate.toISOString() || null,
        previousHours: previousHours,
        currentEquipmentHours: Number(entry.equipment.currentHours),
      };
    })
  );

  return ok(entriesWithPrevious);
}
