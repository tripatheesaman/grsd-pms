import { EntryStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

function csvEscape(value: unknown) {
  if (value == null) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

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

  const where: any = {};

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
          equipmentNumber: true,
          displayName: true,
          usageUnit: true,
        },
      },
      createdBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
      approvedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
      rejectedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      entryDate: "desc",
    },
  });

  const header = [
    "EquipmentNumber",
    "EquipmentName",
    "UsageUnit",
    "EntryDate",
    "HoursRun",
    "Status",
    "CreatedBy",
    "CreatedByEmail",
    "CreatedAt",
    "ApprovedBy",
    "ApprovedByEmail",
    "ApprovedAt",
    "RejectedBy",
    "RejectedByEmail",
    "RejectedAt",
  ].join(",");

  const rows = entries.map((entry) => {
    return [
      csvEscape(entry.equipment?.equipmentNumber ?? ""),
      csvEscape(entry.equipment?.displayName ?? ""),
      csvEscape(entry.equipment?.usageUnit ?? ""),
      csvEscape(entry.entryDate.toISOString()),
      csvEscape(Number(entry.hoursRun).toFixed(2)),
      csvEscape(entry.status),
      csvEscape(entry.createdBy?.fullName ?? ""),
      csvEscape(entry.createdBy?.email ?? ""),
      csvEscape(entry.createdAt.toISOString()),
      csvEscape(entry.approvedBy?.fullName ?? ""),
      csvEscape(entry.approvedBy?.email ?? ""),
      csvEscape(entry.approvedAt ? entry.approvedAt.toISOString() : ""),
      csvEscape(entry.rejectedBy?.fullName ?? ""),
      csvEscape(entry.rejectedBy?.email ?? ""),
      csvEscape(entry.rejectedAt ? entry.rejectedAt.toISOString() : ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  const fileNameParts: string[] = ["entries-export"];
  if (status && status !== "ALL") {
    fileNameParts.push(status.toLowerCase());
  }
  if (equipmentId) {
    fileNameParts.push("equip", equipmentId.replace(/[^A-Za-z0-9_-]/g, ""));
  }
  if (equipmentFrom || equipmentTo) {
    fileNameParts.push("range");
    if (equipmentFrom) fileNameParts.push(equipmentFrom.replace(/[^A-Za-z0-9_-]/g, ""));
    if (equipmentTo) fileNameParts.push(equipmentTo.replace(/[^A-Za-z0-9_-]/g, ""));
  }
  if (dateFrom || dateTo) {
    fileNameParts.push("date");
    if (dateFrom) fileNameParts.push(dateFrom.replace(/[^0-9-]/g, ""));
    if (dateTo) fileNameParts.push(dateTo.replace(/[^0-9-]/g, ""));
  }
  const fileName = `${fileNameParts.join("_") || "entries-export"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

