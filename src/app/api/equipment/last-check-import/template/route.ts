import ExcelJS from "exceljs";
import { requireAccess } from "@/lib/api/guard";
import { permissionKeys } from "@/lib/security/permissions";

function csvEscape(value: unknown) {
  if (value == null) return "";
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }
  return stringValue;
}

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();

  if (format === "csv") {
    const header = ["equipmentNumber", "lastCheckCode", "lastCheckDate", "lastCheckHours"].join(",");
    const sample = ["1005", "A", "2026-01-15", "500"].map(csvEscape).join(",");
    const csv = [header, sample].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="last-check-import-template.csv"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("LastChecks");

  sheet.columns = [
    { header: "equipmentNumber", key: "equipmentNumber", width: 20 },
    { header: "lastCheckCode", key: "lastCheckCode", width: 14 },
    { header: "lastCheckDate", key: "lastCheckDate", width: 16 },
    { header: "lastCheckHours", key: "lastCheckHours", width: 16 },
  ];

  sheet.addRow({
    equipmentNumber: "1005",
    lastCheckCode: "A",
    lastCheckDate: "2026-01-15",
    lastCheckHours: 500,
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return new Response(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="last-check-import-template.xlsx"`,
    },
  });
}

