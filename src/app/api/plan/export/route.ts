import { NextResponse } from "next/server";
import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { syncEquipmentPlan } from "@/lib/planning/sync";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type ExportMode = "equipment" | "pictorial";
type ExportFormat = "csv" | "html";

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

function isoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function startOfIsoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 1 - dayNumber);
  return value;
}

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.planRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const modeRaw = (url.searchParams.get("mode") ?? "equipment").trim();
  const formatRaw = (url.searchParams.get("format") ?? "csv").trim();
  const mode: ExportMode =
    modeRaw === "pictorial" ? "pictorial" : "equipment";
  const format: ExportFormat = formatRaw === "html" ? "html" : "csv";

  const equipmentFrom = url.searchParams.get("equipmentFrom")?.trim() || "";
  const equipmentTo = url.searchParams.get("equipmentTo")?.trim() || "";
  const dateFromRaw = url.searchParams.get("dateFrom")?.trim() || "";
  const dateToRaw = url.searchParams.get("dateTo")?.trim() || "";
  const refreshBeforeExport = url.searchParams.get("refresh") === "true";

  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  if (dateFromRaw) {
    const value = new Date(`${dateFromRaw}T00:00:00.000Z`);
    if (!Number.isNaN(value.getTime())) {
      dateFrom = value;
    }
  }

  if (dateToRaw) {
    const value = new Date(`${dateToRaw}T23:59:59.999Z`);
    if (!Number.isNaN(value.getTime())) {
      dateTo = value;
    }
  }

  const currentYear = new Date().getUTCFullYear();
  const yearFrom = dateFrom ? dateFrom.getUTCFullYear() : currentYear;
  const yearTo = dateTo ? dateTo.getUTCFullYear() : yearFrom;
  const years: number[] = [];
  for (let y = Math.min(yearFrom, yearTo); y <= Math.max(yearFrom, yearTo); y += 1) {
    if (y >= 2000 && y <= 2100) years.push(y);
  }

  if (!dateFrom && !dateTo && years.length > 0) {
    const y = years[0];
    dateFrom = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    dateTo = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
  }

  const where: any = {};

  if (dateFrom || dateTo) {
    where.dueDate = {};
    if (dateFrom) {
      where.dueDate.gte = dateFrom;
    }
    if (dateTo) {
      where.dueDate.lte = dateTo;
    }
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

  const equipmentsToSync = await prisma.equipment.findMany({
    where: {
      isActive: true,
      ...(equipmentFrom || equipmentTo
        ? {
            equipmentNumber: {
              ...(equipmentFrom ? { gte: equipmentFrom } : {}),
              ...(equipmentTo ? { lte: equipmentTo } : {}),
            },
          }
        : {}),
    },
    select: { id: true, equipmentNumber: true, displayName: true },
    orderBy: { equipmentNumber: "asc" },
  });

  if (refreshBeforeExport) {
    const batchSize = 30;
    for (let i = 0; i < equipmentsToSync.length; i += batchSize) {
      const batch = equipmentsToSync.slice(i, i + batchSize);
      for (const year of years) {
        await Promise.all(batch.map((e) => syncEquipmentPlan(e.id, year)));
      }
    }
  }

  if (mode === "pictorial" || format === "html") {
    const sheets = await prisma.checkSheet.findMany({
      where: {
        equipmentId: {
          in: equipmentsToSync.map((e) => e.id),
        },
        ...(where.dueDate
          ? {
              dueDate: where.dueDate,
            }
          : {}),
        status: {
          in: [
            CheckStatus.PREDICTED,
            CheckStatus.ISSUE_REQUIRED,
            CheckStatus.NEAR_DUE,
            CheckStatus.OVERDUE,
          ],
        },
      },
      select: {
        equipmentId: true,
        checkCode: true,
        dueDate: true,
        dueHours: true,
        status: true,
      },
      orderBy: [
        { dueDate: "asc" },
        { checkCode: "asc" },
      ],
    });

    const equipmentMap = new Map(equipmentsToSync.map((e) => [e.id, e]));
    const pictorialData: Array<{
      equipmentNumber: string;
      displayName: string;
      checkCode: string;
      dueDate: Date;
      dueHours: number;
      status: CheckStatus;
    }> = [];

    const seenByWeek = new Set<string>();
    for (const s of sheets) {
      const eq = equipmentMap.get(s.equipmentId);
      if (!eq) continue;
      const week = isoWeek(s.dueDate);
      const key = `${eq.id}:${s.checkCode}:${week}`;
      if (seenByWeek.has(key)) {
        continue;
      }
      seenByWeek.add(key);
      const weekDate = startOfIsoWeek(s.dueDate);
      pictorialData.push({
        equipmentNumber: eq.equipmentNumber,
        displayName: eq.displayName,
        checkCode: s.checkCode,
        dueDate: weekDate,
        dueHours: Number(s.dueHours),
        status: s.status,
      });
    }

    const equipmentCount = new Set(pictorialData.map((s) => s.equipmentNumber)).size;
    if (equipmentCount > 200) {
      return NextResponse.json(
        { error: { code: "TOO_LARGE", message: "Too many equipments for pictorial export. Please provide an equipment range." } },
        { status: 400 },
      );
    }

    const byEquipment = new Map<
      string,
      Array<{ dueDate: Date; checkCode: string; dueHours: number; status: CheckStatus }>
    >();
    const equipmentName = new Map<string, string>();

    for (const sheet of pictorialData) {
      const eqNo = sheet.equipmentNumber;
      if (!byEquipment.has(eqNo)) {
        byEquipment.set(eqNo, []);
      }
      byEquipment.get(eqNo)!.push({
        dueDate: sheet.dueDate,
        checkCode: sheet.checkCode,
        dueHours: sheet.dueHours,
        status: sheet.status,
      });
      equipmentName.set(eqNo, sheet.displayName);
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const equipmentKeys = [...byEquipment.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Plan Export</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f4f7fb;color:#10233f}
.wrap{padding:20px}
.card{background:#fff;border:1px solid #e7eef8;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.06);padding:16px;margin-bottom:14px}
.title{font-weight:800;font-size:16px;margin:0 0 8px}
.sub{font-size:12px;color:#3e5678;margin:0 0 10px}
table{width:100%;border-collapse:separate;border-spacing:0}
th,td{border:1px solid #e7eef8;padding:10px;vertical-align:top}
th{background:#f7f9fe;font-size:12px;text-align:left}
.eq{font-weight:900;font-size:13px}
.eqname{font-size:11px;color:#3e5678;font-weight:600}
.chip{display:inline-block;margin:4px 6px 0 0;padding:4px 8px;border-radius:999px;background:#0b3d91;color:#fff;font-size:11px;font-weight:800}
.chip small{opacity:.9;font-weight:700}
.chip-predicted{background:#0b3d91}
.chip-issue-required{background:#d97706}
.chip-near-due{background:#ea580c}
.chip-overdue{background:#b91c1c}
.muted{color:#3e5678;font-size:11px}
.legend{margin-top:4px;margin-bottom:8px}
.legend-row{display:flex;flex-wrap:wrap;gap:10px}
.legend-item{display:flex;align-items:center;font-size:11px;color:#10233f}
.legend-swatch{width:14px;height:14px;border-radius:999px;margin-right:6px}
@media print{body{background:#fff}.card{box-shadow:none}}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
<p class="title">Maintenance Plan Report</p>
<p class="sub"><b>Format:</b> <b>09</b> <b>A</b> <b>800.00</b> means <b>Day-of-month</b>, <b>Check Code</b>, <b>Scheduled Hrs/Kms</b></p>
</div>
${equipmentKeys
  .map((eqNo) => {
    const items = byEquipment.get(eqNo) ?? [];
    const buckets = new Map<number, Array<{ d: Date; c: string; h: number; s: string }>>();
    for (let m = 0; m < 12; m += 1) {
      buckets.set(m, []);
    }
    for (const item of items) {
      buckets
        .get(item.dueDate.getUTCMonth())
        ?.push({ d: item.dueDate, c: item.checkCode, h: item.dueHours, s: item.status });
    }
    const name = equipmentName.get(eqNo) ?? "";
    return `<div class="card">
<div class="eq">${eqNo} <span class="eqname">${name}</span></div>
<table>
<thead><tr>${monthNames.map((m) => `<th>${m}</th>`).join("")}</tr></thead>
<tbody><tr>${monthNames
  .map((_, idx) => {
    const list = buckets.get(idx) ?? [];
    if (list.length === 0) {
      return `<td><span class="muted">No checks</span></td>`;
    }
    return `<td>${list
      .map((x) => {
        const day = String(x.d.getUTCDate()).padStart(2, "0");
        const cls = `chip chip-${x.s.toLowerCase().replace(/_/g, "-")}`;
        return `<span class="${cls}">${day} ${x.c} <small>${x.h.toFixed(2)}</small></span>`;
      })
      .join("")}</td>`;
  })
  .join("")}</tr></tbody>
</table>
</div>`;
  })
  .join("")}
</div>
</body>
</html>`;

    const fileNameParts: string[] = ["plan-export", "pictorial"];
    if (equipmentFrom || equipmentTo) {
      fileNameParts.push("equip");
      if (equipmentFrom) fileNameParts.push(equipmentFrom.replace(/[^A-Za-z0-9_-]/g, ""));
      if (equipmentTo) fileNameParts.push(equipmentTo.replace(/[^A-Za-z0-9_-]/g, ""));
    }
    if (dateFromRaw || dateToRaw) {
      fileNameParts.push("date");
      if (dateFromRaw) fileNameParts.push(dateFromRaw.replace(/[^0-9-]/g, ""));
      if (dateToRaw) fileNameParts.push(dateToRaw.replace(/[^0-9-]/g, ""));
    }
    const htmlFileName = `${fileNameParts.join("_") || "plan-export_pictorial"}.html`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${htmlFileName}"`,
      },
    });
  }

  const sheets = await prisma.checkSheet.findMany({
    where: {
      ...where,
      status: {
        in: [
          CheckStatus.PREDICTED,
          CheckStatus.ISSUE_REQUIRED,
          CheckStatus.NEAR_DUE,
          CheckStatus.OVERDUE,
        ],
      },
    },
    select: {
      checkCode: true,
      dueDate: true,
      dueHours: true,
      equipment: {
        select: {
          equipmentNumber: true,
        },
      },
    },
    orderBy: [
      { equipment: { equipmentNumber: "asc" } },
      { dueDate: "asc" },
      { checkCode: "asc" },
    ],
  });

  sheets.sort((a, b) => {
    const aEq = a.equipment.equipmentNumber;
    const bEq = b.equipment.equipmentNumber;
    const eqCmp = aEq.localeCompare(bEq, undefined, { numeric: true, sensitivity: "base" });
    if (eqCmp !== 0) return eqCmp;
    const dCmp = a.dueDate.getTime() - b.dueDate.getTime();
    if (dCmp !== 0) return dCmp;
    return a.checkCode.localeCompare(b.checkCode, undefined, { numeric: true, sensitivity: "base" });
  });

  const header = [
    "EquipmentNumber",
    "CheckCode",
    "PredictedDate(YYYY-MM-DD)",
    "ScheduledHours(0.00)",
  ].join(",");

  const rows = sheets.map((sheet) => {
    const s: any = sheet;
    return [
      csvEscape(s.equipment?.equipmentNumber ?? ""),
      csvEscape(s.checkCode ?? ""),
      csvEscape(s.dueDate.toISOString().slice(0, 10)),
      csvEscape(Number(s.dueHours).toFixed(2)),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");

  const fileNameParts: string[] = ["plan-export"];
  fileNameParts.push(mode);
  if (equipmentFrom || equipmentTo) {
    fileNameParts.push("equip");
    if (equipmentFrom) fileNameParts.push(equipmentFrom.replace(/[^A-Za-z0-9_-]/g, ""));
    if (equipmentTo) fileNameParts.push(equipmentTo.replace(/[^A-Za-z0-9_-]/g, ""));
  }
  if (dateFromRaw || dateToRaw) {
    fileNameParts.push("date");
    if (dateFromRaw) fileNameParts.push(dateFromRaw.replace(/[^0-9-]/g, ""));
    if (dateToRaw) fileNameParts.push(dateToRaw.replace(/[^0-9-]/g, ""));
  }
  const fileName = `${fileNameParts.join("_") || "plan-export"}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

