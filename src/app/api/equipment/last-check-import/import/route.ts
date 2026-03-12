import ExcelJS from "exceljs";
import { CheckStatus, TriggerType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/api/guard";
import { ok } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";

type ImportRow = {
  equipmentNumber: string;
  lastCheckCode: string;
  lastCheckDate: string;
  lastCheckHours: string;
};

function normalizeCell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
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
      lastCheckCode: parts[1] ?? "",
      lastCheckDate: parts[2] ?? "",
      lastCheckHours: parts[3] ?? "",
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
  const cCode = getCol("lastcheckcode");
  const cDate = getCol("lastcheckdate");
  const cHours = getCol("lastcheckhours");

  if (cEquip < 1 || cCode < 1 || cDate < 1 || cHours < 1) {
    return [];
  }

  const rows: ImportRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const equipmentNumber = normalizeCell(row.getCell(cEquip).value);
    const lastCheckCode = normalizeCell(row.getCell(cCode).value);
    const lastCheckDate = normalizeCell(row.getCell(cDate).value);
    const lastCheckHours = normalizeCell(row.getCell(cHours).value);
    if (!equipmentNumber && !lastCheckCode && !lastCheckDate && !lastCheckHours) continue;
    rows.push({ equipmentNumber, lastCheckCode, lastCheckDate, lastCheckHours });
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
  const normalized = rows.map((r, index) => {
    const equipmentNumber = r.equipmentNumber.trim();
    const lastCheckCode = r.lastCheckCode.trim().toUpperCase();
    const lastCheckDate = r.lastCheckDate.trim();
    const lastCheckHoursRaw = r.lastCheckHours.trim();
    const date = new Date(`${lastCheckDate}T00:00:00.000Z`);
    const hours = Number(lastCheckHoursRaw);

    if (!equipmentNumber) {
      errors.push({ row: index + 2, message: "equipmentNumber is required" });
    }
    if (!/^[A-Z]$/.test(lastCheckCode)) {
      errors.push({ row: index + 2, message: "lastCheckCode must be a single letter A-Z" });
    }
    if (Number.isNaN(date.getTime())) {
      errors.push({ row: index + 2, message: "lastCheckDate must be YYYY-MM-DD" });
    }
    if (!Number.isFinite(hours) || hours < 0) {
      errors.push({ row: index + 2, message: "lastCheckHours must be a non-negative number" });
    }

    return {
      equipmentNumber,
      lastCheckCode,
      lastCheckDate: date,
      lastCheckHours: hours,
    };
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

  const equipmentIds = equipments.map((e) => e.id);
  const rules = await prisma.checkRule.findMany({
    where: { equipmentId: { in: equipmentIds } },
    select: { id: true, equipmentId: true, code: true },
  });
  const ruleKey = (equipmentId: string, code: string) => `${equipmentId}:${code}`;
  const ruleByEquipmentAndCode = new Map(rules.map((r) => [ruleKey(r.equipmentId, r.code), r]));

  const validItems: Array<{
    equipmentId: string;
    equipmentNumber: string;
    checkRuleId: string;
    checkCode: string;
    dueHours: number;
    dueDate: Date;
  }> = [];

  for (let i = 0; i < normalized.length; i += 1) {
    const row = normalized[i];
    const eq = equipmentByNumber.get(row.equipmentNumber);
    if (!eq) continue;
    const rule = ruleByEquipmentAndCode.get(ruleKey(eq.id, row.lastCheckCode));
    if (!rule) {
      errors.push({ row: i + 2, message: `check rule not found for ${row.equipmentNumber} code ${row.lastCheckCode}` });
      continue;
    }
    validItems.push({
      equipmentId: eq.id,
      equipmentNumber: eq.equipmentNumber,
      checkRuleId: rule.id,
      checkCode: row.lastCheckCode,
      dueHours: row.lastCheckHours,
      dueDate: row.lastCheckDate,
    });
  }

  if (validItems.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "No valid rows to import." }, errors },
      { status: 400 },
    );
  }

  const existing = await prisma.checkSheet.findMany({
    where: {
      OR: validItems.map((i) => ({
        equipmentId: i.equipmentId,
        checkCode: i.checkCode,
        dueHours: i.dueHours,
      })),
    },
    select: { id: true, equipmentId: true, checkCode: true, dueHours: true },
  });

  const existingKey = (equipmentId: string, checkCode: string, dueHours: number) =>
    `${equipmentId}:${checkCode}:${dueHours}`;
  const existingMap = new Map(existing.map((s) => [existingKey(s.equipmentId, s.checkCode, Number(s.dueHours)), s]));

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of validItems) {
      const key = existingKey(item.equipmentId, item.checkCode, item.dueHours);
      const found = existingMap.get(key);
      if (found) {
        updated += 1;
        await tx.checkSheet.update({
          where: { id: found.id },
          data: {
            checkRuleId: item.checkRuleId,
            dueDate: item.dueDate,
            triggerType: TriggerType.HOURS,
            status: CheckStatus.COMPLETED,
            completedAt: item.dueDate,
            issuedAt: null,
            completedHours: null,
            remarks: null,
          },
        });
      } else {
        created += 1;
        await tx.checkSheet.create({
          data: {
            equipmentId: item.equipmentId,
            checkRuleId: item.checkRuleId,
            checkCode: item.checkCode,
            dueHours: item.dueHours,
            dueDate: item.dueDate,
            triggerType: TriggerType.HOURS,
            status: CheckStatus.COMPLETED,
            completedAt: item.dueDate,
          },
        });
      }
    }
  });

  return ok({
    totalRows: rows.length,
    validRows: validItems.length,
    created,
    updated,
    errorCount: errors.length,
    errors,
  });
}

