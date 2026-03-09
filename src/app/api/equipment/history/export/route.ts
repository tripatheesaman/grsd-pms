import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import { requireAccess } from "@/lib/api/guard";
import { fail } from "@/lib/api/response";
import { buildUploadPath } from "@/lib/uploads";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { CheckStatus, EntryStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const equipmentFrom = url.searchParams.get("equipmentFrom");
  const equipmentTo = url.searchParams.get("equipmentTo");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  let sectionCode = "";
  try {
    const config = await (prisma as any).systemConfig?.findUnique({
      where: { key: "section_code" },
    });
    sectionCode = config?.value || "";
  } catch {}

  const templatePath = buildUploadPath("templates", "equipment-history-template.xlsx");
  let workbook: ExcelJS.Workbook;
  try {
    const templateBuffer = await readFile(templatePath);
    workbook = new ExcelJS.Workbook();
    await (workbook.xlsx as any).load(templateBuffer);
  } catch (error) {
    return fail("NOT_FOUND", "Template file not found. Please ensure equipment-history-template.xlsx exists in templates directory.", 404);
  }

  const templateSheet = workbook.getWorksheet("Template");
  if (!templateSheet) {
    return fail("BAD_REQUEST", "Template sheet not found in template file", 400);
  }

  const equipmentWhere: any = {};
  if (equipmentFrom || equipmentTo) {
    equipmentWhere.equipmentNumber = {};
    if (equipmentFrom) {
      equipmentWhere.equipmentNumber.gte = equipmentFrom;
    }
    if (equipmentTo) {
      equipmentWhere.equipmentNumber.lte = equipmentTo;
    }
  }

  const equipments = await prisma.equipment.findMany({
    where: equipmentWhere,
    include: {
      checkRules: {
        where: { isActive: true },
        orderBy: { code: "asc" },
      },
    },
    orderBy: { equipmentNumber: "asc" },
  });

  if (equipments.length === 0) {
    return fail("NOT_FOUND", "No equipment found matching the filters", 404);
  }

  const dateFromObj = dateFrom ? new Date(dateFrom) : null;
  const dateToObj = dateTo ? new Date(dateTo) : null;
  if (dateToObj) {
    dateToObj.setHours(23, 59, 59, 999);
  }

  for (const equipment of equipments) {
    const sheet = workbook.addWorksheet(equipment.equipmentNumber, {
      properties: {},
    });

    templateSheet.eachRow((row, rowNumber) => {
      const newRow = sheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const newCell = newRow.getCell(colNumber);
        newCell.value = cell.value;
        newCell.style = JSON.parse(JSON.stringify(cell.style));
        if (cell.formula) {
          newCell.value = { formula: cell.formula, result: (cell as any).result };
        }
        if (cell.hyperlink) {
          newCell.value = { text: cell.value?.toString() || "", hyperlink: cell.hyperlink };
        }
        if (cell.note) {
          newCell.note = cell.note;
        }
      });
      newRow.height = row.height;
    });

    const processedRanges = new Set<string>();
    
    const templateModel = (templateSheet as any).model;
    if (templateModel) {
      if (templateModel.merges) {
        const merges = templateModel.merges;
        if (Array.isArray(merges)) {
          for (const merge of merges) {
            try {
              let rangeStr = '';
              if (typeof merge === 'string') {
                rangeStr = merge;
              } else if (merge && typeof merge === 'object') {
                if (merge.top !== undefined && merge.left !== undefined && merge.bottom !== undefined && merge.right !== undefined) {
                  const startCell = sheet.getCell(merge.top, merge.left);
                  const endCell = sheet.getCell(merge.bottom, merge.right);
                  rangeStr = `${startCell.address}:${endCell.address}`;
                } else if (merge.s && merge.e) {
                  const startCell = sheet.getCell(merge.s.r + 1, merge.s.c + 1);
                  const endCell = sheet.getCell(merge.e.r + 1, merge.e.c + 1);
                  rangeStr = `${startCell.address}:${endCell.address}`;
                }
              }
              
              if (rangeStr && !processedRanges.has(rangeStr)) {
                sheet.mergeCells(rangeStr);
                processedRanges.add(rangeStr);
              }
            } catch (error) {
            }
          }
        } else if (typeof merges === 'object' && !Array.isArray(merges)) {
          for (const key in merges) {
            try {
              const merge = merges[key];
              let rangeStr = '';
              if (typeof merge === 'string') {
                rangeStr = merge;
              } else if (merge && typeof merge === 'object') {
                if (merge.top !== undefined && merge.left !== undefined && merge.bottom !== undefined && merge.right !== undefined) {
                  const startCell = sheet.getCell(merge.top, merge.left);
                  const endCell = sheet.getCell(merge.bottom, merge.right);
                  rangeStr = `${startCell.address}:${endCell.address}`;
                } else if (merge.s && merge.e) {
                  const startCell = sheet.getCell(merge.s.r + 1, merge.s.c + 1);
                  const endCell = sheet.getCell(merge.e.r + 1, merge.e.c + 1);
                  rangeStr = `${startCell.address}:${endCell.address}`;
                }
              }
              
              if (rangeStr && !processedRanges.has(rangeStr)) {
                sheet.mergeCells(rangeStr);
                processedRanges.add(rangeStr);
              }
            } catch (error) {
            }
          }
        }
      }
      
      if (templateModel.mergedCells) {
        const mergedCells = templateModel.mergedCells;
        if (Array.isArray(mergedCells)) {
          for (const mergedCell of mergedCells) {
            try {
              if (typeof mergedCell === 'string') {
                if (!processedRanges.has(mergedCell)) {
                  sheet.mergeCells(mergedCell);
                  processedRanges.add(mergedCell);
                }
              } else if (mergedCell && typeof mergedCell === 'object' && mergedCell.address) {
                if (!processedRanges.has(mergedCell.address)) {
                  sheet.mergeCells(mergedCell.address);
                  processedRanges.add(mergedCell.address);
                }
              }
            } catch (error) {
            }
          }
        }
      }
    }
    
    templateSheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.isMerged && cell.master) {
          try {
            const master = cell.master;
            const masterAddress = master.address;
            const masterStart = masterAddress.split(":")[0];
            if (!Array.from(processedRanges).some((r: string) => r.includes(masterStart))) {
              const masterRow = Number((master as any).row);
              const masterCol = Number((master as any).col);
              let minRow: number = masterRow;
              let minCol: number = masterCol;
              let maxRow: number = masterRow;
              let maxCol: number = masterCol;
              
              templateSheet.eachRow((checkRow) => {
                checkRow.eachCell({ includeEmpty: true }, (checkCell) => {
                  if (checkCell.isMerged && checkCell.master && checkCell.master.address === masterAddress) {
                    const r = Number((checkCell as any).row);
                    const c = Number((checkCell as any).col);
                    minRow = Math.min(minRow, r);
                    minCol = Math.min(minCol, c);
                    maxRow = Math.max(maxRow, r);
                    maxCol = Math.max(maxCol, c);
                  }
                });
              });
              
              if (minRow !== maxRow || minCol !== maxCol) {
                const range = `${sheet.getCell(minRow, minCol).address}:${sheet.getCell(maxRow, maxCol).address}`;
                if (!processedRanges.has(range)) {
                  sheet.mergeCells(range);
                  processedRanges.add(range);
                }
              }
            }
          } catch (error) {
          }
        }
      });
    });

    for (let col = 1; col <= 7; col++) {
      const colLetter = String.fromCharCode(64 + col);
      const templateCol = templateSheet.getColumn(col);
      const newCol = sheet.getColumn(colLetter);
      newCol.width = templateCol.width || 15;
      if (templateCol.style) {
        newCol.style = JSON.parse(JSON.stringify(templateCol.style));
      }
    }

    const g1Cell = sheet.getCell("G1");
    g1Cell.value = `Form no: GrSD/${sectionCode}/${equipment.equipmentNumber}`;

    const a8Cell = sheet.getCell("A8");
    a8Cell.value = `Ground Equipment Number: ${equipment.equipmentNumber}`;

    const baseRow = 9;
    const cols = ["A", "D", "G"] as const;
    const maxCols = cols.length;

    const rulesPerCol = equipment.checkRules.length > 12 ? 4 : 3;
    const rules = equipment.checkRules;
    const groupSize = rulesPerCol * maxCols;

    const buildRowDataFrom = (fromRowNum: number) => {
      const fromRow = sheet.getRow(fromRowNum);
      const rowData: any = {};
      fromRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        rowData[colNum] = cell.value;
      });
      return rowData;
    };

    const cloneRowFormatting = (fromRowNum: number, toRowNum: number) => {
      const fromRow = sheet.getRow(fromRowNum);
      const toRow = sheet.getRow(toRowNum);
      toRow.height = fromRow.height;
      fromRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const targetCell = toRow.getCell(colNum);
        targetCell.value = cell.value;
        targetCell.style = JSON.parse(JSON.stringify(cell.style));
        if (cell.formula) {
          targetCell.value = { formula: cell.formula, result: (cell as any).result };
        }
        if (cell.hyperlink) {
          targetCell.value = { text: cell.value?.toString() || "", hyperlink: cell.hyperlink };
        }
        if (cell.note) {
          targetCell.note = cell.note;
        }
      });
    };

    const insertClonedRow = (insertAtRowNum: number, cloneFromRowNum: number) => {
      sheet.spliceRows(insertAtRowNum, 0, [buildRowDataFrom(cloneFromRowNum)]);
      cloneRowFormatting(cloneFromRowNum, insertAtRowNum);
    };

    const blockCount = rules.length > 0 ? Math.ceil(rules.length / groupSize) : 0;
    const blockStartRows: number[] = [];
    let insertedSoFar = 0;
    let lastCheckRow = baseRow;

    for (let block = 0; block < blockCount; block++) {
      const startIndex = block * groupSize;
      const rulesInBlock = Math.min(groupSize, rules.length - startIndex);
      const maxRowOffsetUsedInBlock = rulesInBlock > 0 ? Math.min(rulesPerCol - 1, rulesInBlock - 1) : 0;

      const blockStartRow = baseRow + block * rulesPerCol + insertedSoFar;
      blockStartRows.push(blockStartRow);

      for (let r = 0; r < maxRowOffsetUsedInBlock; r++) {
        const insertAt = blockStartRow + 1 + r;
        insertClonedRow(insertAt, blockStartRow);
        insertedSoFar++;
      }

      lastCheckRow = Math.max(lastCheckRow, blockStartRow + maxRowOffsetUsedInBlock);

      for (let r = 0; r <= maxRowOffsetUsedInBlock; r++) {
        for (const c of cols) {
          sheet.getCell(`${c}${blockStartRow + r}`).value = null;
        }
      }
    }

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const intervalText = `${rule.intervalHours} ${equipment.usageUnit === "KM" ? "Kms" : "Hrs"}`;

      const block = Math.floor(i / groupSize);
      const withinBlock = i % groupSize;
      const colIndex = Math.floor(withinBlock / rulesPerCol);
      const rowOffset = withinBlock % rulesPerCol;

      const row = blockStartRows[block] + rowOffset;
      const col = cols[colIndex];

      sheet.getCell(`${col}${row}`).value = `Check ${rule.code} : ${intervalText}`;
      lastCheckRow = Math.max(lastCheckRow, row);
    }

    const dataStartRow = lastCheckRow + 2;

    const checkWhere: any = {
      equipmentId: equipment.id,
      status: CheckStatus.COMPLETED,
    };

    if (dateFromObj || dateToObj) {
      checkWhere.completedAt = {};
      if (dateFromObj) checkWhere.completedAt.gte = dateFromObj;
      if (dateToObj) checkWhere.completedAt.lte = dateToObj;
    }

    const completedChecks = await prisma.checkSheet.findMany({
      where: checkWhere,
      include: {
        completedByTechnicians: {
          include: {
            technician: {
              select: {
                name: true,
              },
            },
          },
        },
        checkRule: {
          select: {
            code: true,
            intervalHours: true,
          },
        },
      },
      orderBy: { completedAt: "asc" },
    });

    const groundingWhere: any = { equipmentId: equipment.id };
    if (dateFromObj || dateToObj) {
      groundingWhere.OR = [
        { fromDate: { gte: dateFromObj || undefined, lte: dateToObj || undefined } },
        { toDate: { gte: dateFromObj || undefined, lte: dateToObj || undefined } },
        { AND: [{ fromDate: { lte: dateFromObj || undefined } }, { toDate: { gte: dateToObj || undefined } }] },
      ].filter((c) => Object.keys(c).length > 0);
    }

    const groundingPeriods = await (prisma as any).groundingPeriod.findMany({
      where: groundingWhere,
      orderBy: { fromDate: "asc" },
    });

    let dataRow = dataStartRow;
    let serialNumber = 1;
    const thin = { style: "thin" as const };
    const applyCheckDataRowFormat = (rowNumber: number) => {
      for (let col = 1; col <= 7; col++) {
        const cell = sheet.getCell(rowNumber, col);
        cell.border = { top: thin, left: thin, bottom: thin, right: thin };
        const existing = cell.alignment ?? {};
        cell.alignment = { ...existing, horizontal: "center", vertical: "middle" };
      }
    };

    for (const check of completedChecks) {
      const scheduledHours = Number(check.dueHours);
      const checkCode = check.checkCode;
      const completionDate = check.completedAt ? new Date(check.completedAt) : null;
      const completionHours = check.completedHours !== null ? Number(check.completedHours) : null;
      const technicianNames = check.completedByTechnicians.map((ct: any) => ct.technician.name).filter(Boolean);
      const technicianInitials = technicianNames.length > 0
        ? technicianNames
            .map((name: string) =>
              name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 3)
            )
            .join(", ")
        : "";

      let remarks = check.remarks || "";

      const activeGrounding = groundingPeriods.find((gp: any) => {
        const gpFrom = new Date(gp.fromDate);
        const gpTo = gp.toDate ? new Date(gp.toDate) : new Date();
        return completionDate && completionDate >= gpFrom && completionDate <= gpTo;
      });

      if (activeGrounding) {
        const checkDueDate = new Date(check.dueDate);
        const gpFrom = new Date(activeGrounding.fromDate);
        if (checkDueDate < gpFrom) {
          remarks = `Check was delayed because the equipment was grounded because of ${activeGrounding.reason}`;
        }
      }

      if (dataRow > dataStartRow) {
        const prevRow = sheet.getRow(dataRow - 1);
        const newRow = sheet.getRow(dataRow);
        prevRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
          const targetCell = newRow.getCell(colNum);
          targetCell.value = cell.value;
          targetCell.style = JSON.parse(JSON.stringify(cell.style));
        });
        dataRow++;
      }

      sheet.getCell(`A${dataRow}`).value = serialNumber;
      sheet.getCell(`B${dataRow}`).value = scheduledHours.toFixed(2);
      sheet.getCell(`C${dataRow}`).value = checkCode;
      if (completionDate) {
        sheet.getCell(`D${dataRow}`).value = completionDate.toISOString().split("T")[0];
      }
      if (completionHours !== null) {
        sheet.getCell(`E${dataRow}`).value = completionHours.toFixed(2);
      }
      sheet.getCell(`F${dataRow}`).value = technicianInitials;
      sheet.getCell(`G${dataRow}`).value = remarks;
      applyCheckDataRowFormat(dataRow);

      serialNumber++;
      dataRow++;
    }
  }

  workbook.removeWorksheet("Template");

  const buffer = await workbook.xlsx.writeBuffer();

  const fileNameParts = ["equipment-history-export"];
  if (equipmentFrom) fileNameParts.push(`from-${equipmentFrom.replace(/[^A-Za-z0-9_-]/g, "")}`);
  if (equipmentTo) fileNameParts.push(`to-${equipmentTo.replace(/[^A-Za-z0-9_-]/g, "")}`);
  if (dateFrom) fileNameParts.push(`dateFrom-${dateFrom.replace(/[^0-9-]/g, "")}`);
  if (dateTo) fileNameParts.push(`dateTo-${dateTo.replace(/[^0-9-]/g, "")}`);
  const fileName = `${fileNameParts.join("_")}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
