import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type ImportRow = {
  equipmentNumber: string;
  lastYearCheckCode: string;
  lastYearCheckDate: string;
  lastYearCheckHours: string;
};

function normalizeCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function parseDateFlexible(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return new Date("invalid");
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  }
  return new Date("invalid");
}

function parseCsv(content: string): ImportRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length <= 1) return [];
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    rows.push({
      equipmentNumber: parts[0] ?? "",
      lastYearCheckCode: parts[1] ?? "",
      lastYearCheckDate: parts[2] ?? "",
      lastYearCheckHours: parts[3] ?? "",
    });
  }
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  const nodeBuffer = Buffer.from(new Uint8Array(buffer));
  await workbook.xlsx.load(nodeBuffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headerIndex = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const key = normalizeCell(cell.value).toLowerCase();
    if (key) headerIndex.set(key, colNumber);
  });

  const getCol = (name: string) => headerIndex.get(name.toLowerCase()) ?? -1;
  const cEquip = getCol("equipmentnumber");
  const cCode = getCol("lastyearcheckcode");
  const cDate = getCol("lastyearcheckdate");
  const cHours = getCol("lastyearcheckhours");

  if (cEquip < 1 || cCode < 1 || cDate < 1 || cHours < 1) {
    return [];
  }

  const rows: ImportRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const equipmentNumber = normalizeCell(row.getCell(cEquip).value);
    const lastYearCheckCode = normalizeCell(row.getCell(cCode).value);
    const lastYearCheckDate = normalizeCell(row.getCell(cDate).value);
    const lastYearCheckHours = normalizeCell(row.getCell(cHours).value);
    if (!equipmentNumber && !lastYearCheckCode && !lastYearCheckDate && !lastYearCheckHours) continue;
    rows.push({ equipmentNumber, lastYearCheckCode, lastYearCheckDate, lastYearCheckHours });
  }

  return rows;
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "No file provided" } }, { status: 400 });
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "File size must be less than 10MB" } },
      { status: 400 },
    );
  }

  const bytes = await file.arrayBuffer();
  let rows: ImportRow[] = [];
  const name = (file.name || "").toLowerCase();

  if (name.endsWith(".xlsx")) {
    rows = await parseXlsx(bytes);
  } else {
    const content = Buffer.from(bytes).toString("utf-8");
    rows = parseCsv(content);
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "No rows found. Please use the provided template." } },
      { status: 400 },
    );
  }

  const errors: Array<{ row: number; message: string }> = [];
  const normalized: Array<{
    equipmentNumber: string;
    lastYearCheckCode: string;
    lastYearCheckDate: Date;
    lastYearCheckHours: number;
  }> = [];

  rows.forEach((r, index) => {
    const equipmentNumber = r.equipmentNumber.trim();
    const codeRaw = r.lastYearCheckCode.trim().toUpperCase();
    const dateRaw = r.lastYearCheckDate.trim();
    const hoursRaw = r.lastYearCheckHours.trim();

    if (!codeRaw) {
      return;
    }

    const date = parseDateFlexible(dateRaw);
    const hours = Number(hoursRaw);
    let hasError = false;

    if (!equipmentNumber) {
      errors.push({ row: index + 2, message: "equipmentNumber is required" });
      hasError = true;
    }
    if (!/^[A-Z]$/.test(codeRaw)) {
      errors.push({ row: index + 2, message: "lastYearCheckCode must be a single letter A-Z" });
      hasError = true;
    }
    if (Number.isNaN(date.getTime())) {
      errors.push({ row: index + 2, message: "lastYearCheckDate must be YYYY-MM-DD or MM/DD/YYYY" });
      hasError = true;
    }
    if (!Number.isFinite(hours) || hours < 0) {
      errors.push({ row: index + 2, message: "lastYearCheckHours must be a non-negative number" });
      hasError = true;
    }

    if (!hasError) {
      normalized.push({
        equipmentNumber,
        lastYearCheckCode: codeRaw,
        lastYearCheckDate: date,
        lastYearCheckHours: hours,
      });
    }
  });

  const uniqueEquipNumbers = [...new Set(normalized.map((r) => r.equipmentNumber).filter(Boolean))];
  const equipments = await prisma.equipment.findMany({
    where: { equipmentNumber: { in: uniqueEquipNumbers } },
    select: { id: true, equipmentNumber: true },
  });
  const equipmentByNumber = new Map(equipments.map((e) => [e.equipmentNumber, e]));

  for (let i = 0; i < normalized.length; i += 1) {
    const r = normalized[i];
    if (!equipmentByNumber.has(r.equipmentNumber)) {
      errors.push({ row: i + 2, message: `equipmentNumber not found: ${r.equipmentNumber}` });
    }
  }

  const validItems: Array<{
    equipmentId: string;
    equipmentNumber: string;
    lastYearCheckCode: string;
    lastYearCheckDate: Date;
    lastYearCheckHours: number;
  }> = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const row = normalized[i];
    const eq = equipmentByNumber.get(row.equipmentNumber);
    if (!eq) continue;
    validItems.push({
      equipmentId: eq.id,
      equipmentNumber: eq.equipmentNumber,
      lastYearCheckCode: row.lastYearCheckCode,
      lastYearCheckDate: row.lastYearCheckDate,
      lastYearCheckHours: row.lastYearCheckHours,
    });
  }

  if (validItems.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "No valid rows to import." }, errors },
      { status: 400 },
    );
  }

  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of validItems) {
      updated += 1;
      await tx.equipment.update({
        where: { id: item.equipmentId },
        data: {
          planningBaselineCheckDate: item.lastYearCheckDate,
          planningBaselineHours: item.lastYearCheckHours,
        },
      });
    }
  });

  return ok({
    totalRows: rows.length,
    validRows: validItems.length,
    created: 0,
    updated,
    errorCount: errors.length,
    errors,
  });
}

