import { EntryStatus, Prisma } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import {
  findPreviousApprovedReading,
  minimumReadingFromContext,
} from "@/lib/entries/reading-floor";
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
  const equipmentFrom = searchParams.get("equipmentFrom")?.trim() || "";
  const equipmentTo = searchParams.get("equipmentTo")?.trim() || "";
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where: Prisma.DailyEntryWhereInput = {};

  if (status && status !== "ALL") {
    where.status = status as EntryStatus;
  }

  if (equipmentId) {
    where.equipmentId = equipmentId;
  }

  if (equipmentFrom || equipmentTo) {
    where.equipment = {
      is: {
        equipmentNumber: {
          ...(equipmentFrom ? { gte: equipmentFrom } : {}),
          ...(equipmentTo ? { lte: equipmentTo } : {}),
        },
      },
    };
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

  if (entries.length === 0) {
    return ok([]);
  }

  const equipmentIds = [...new Set(entries.map((e) => e.equipmentId))];
  const maxEntryDate = new Date(
    Math.max(...entries.map((entry) => entry.entryDate.getTime())),
  );

  const [allApprovedEntries, approvedCounts] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
        entryDate: { lt: maxEntryDate },
      },
      select: {
        equipmentId: true,
        meterSegment: true,
        entryDate: true,
        hoursRun: true,
      },
      orderBy: [
        { equipmentId: "asc" },
        { meterSegment: "asc" },
        { entryDate: "asc" },
      ],
    }),
    prisma.dailyEntry.groupBy({
      by: ["equipmentId"],
      where: {
        equipmentId: { in: equipmentIds },
        status: EntryStatus.APPROVED,
      },
      _count: true,
    }),
  ]);

  const approvedByKey = new Map<string, Array<{ entryDate: Date; hoursRun: number }>>();
  for (const entry of allApprovedEntries) {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const rows = approvedByKey.get(k) ?? [];
    rows.push({ entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) });
    approvedByKey.set(k, rows);
  }

  const approvedCountMap = new Map(
    approvedCounts.map((c) => [c.equipmentId, c._count > 0]),
  );

  const entriesWithPrevious = entries.map((entry) => {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const segmentRows = approvedByKey.get(k) ?? [];
    const previousEntry = findPreviousApprovedReading(segmentRows, entry.entryDate);
    const previousHours = minimumReadingFromContext(
      segmentRows,
      entry.entryDate,
      approvedCountMap.get(entry.equipmentId) ?? false,
      Number(entry.equipment.currentHours),
    );

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
  });

  return ok(entriesWithPrevious);
}
