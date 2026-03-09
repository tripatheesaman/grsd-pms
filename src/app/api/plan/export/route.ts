import { NextResponse } from "next/server";
import { CheckStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
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

  if (mode === "pictorial" || format === "html") {
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
        status: true,
        equipment: {
          select: {
            equipmentNumber: true,
            displayName: true,
          },
        },
      },
      orderBy: [
        { equipment: { equipmentNumber: "asc" } },
        { dueDate: "asc" },
        { checkCode: "asc" },
      ],
    });

    const equipmentCount = new Set(sheets.map((s) => s.equipment.equipmentNumber)).size;
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

    for (const sheet of sheets) {
      const eqNo = sheet.equipment.equipmentNumber;
      if (!byEquipment.has(eqNo)) {
        byEquipment.set(eqNo, []);
      }
      byEquipment.get(eqNo)!.push({
        dueDate: sheet.dueDate,
        checkCode: sheet.checkCode,
        dueHours: Number(sheet.dueHours),
        status: sheet.status,
      });
      equipmentName.set(eqNo, sheet.equipment.displayName);
    }

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const equipmentKeys = [...byEquipment.keys()].sort((a, b) => a.localeCompare(b));

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
<p class="sub">Format: 09 A 800.00 is Date, Check Code, Scheduled Hrs/Kms</p>
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

  const header = [
    "EquipmentNumber",
    "CheckCode",
    "PredictedDate",
    "ScheduledHours",
  ].join(",");

  const rows = sheets.map((sheet) => {
    const s: any = sheet;
    return [
      csvEscape(s.equipment?.equipmentNumber ?? ""),
      csvEscape(s.checkCode ?? ""),
      csvEscape(s.dueDate.toISOString()),
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

