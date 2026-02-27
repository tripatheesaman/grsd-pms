import { CheckStatus, EntryStatus } from "@prisma/client";
import { requireAccess } from "@/lib/api/guard";
import { ok, fail } from "@/lib/api/response";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { UPLOADS_BASE_URL } from "@/lib/config/app-config";

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const url = new URL(request.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  let fromDate: Date | undefined;
  let toDate: Date | undefined;

  if (fromRaw) {
    fromDate = new Date(fromRaw);
    if (Number.isNaN(fromDate.getTime())) {
      return fail("BAD_REQUEST", "Invalid from date", 400);
    }
  }

  if (toRaw) {
    toDate = new Date(toRaw);
    if (Number.isNaN(toDate.getTime())) {
      return fail("BAD_REQUEST", "Invalid to date", 400);
    }
    toDate.setHours(23, 59, 59, 999);
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      equipmentNumber: true,
      displayName: true,
      equipmentClass: true,
      usageUnit: true,
      averageHoursPerDay: true,
      currentHours: true,
      commissionedAt: true,
      createdAt: true,
    },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const entryWhere: any = { equipmentId, status: EntryStatus.APPROVED };
  if (fromDate || toDate) {
    entryWhere.entryDate = {};
    if (fromDate) entryWhere.entryDate.gte = fromDate;
    if (toDate) entryWhere.entryDate.lte = toDate;
  }

  const checkWhere: any = { equipmentId };
  if (fromDate || toDate) {
    checkWhere.dueDate = {};
    if (fromDate) checkWhere.dueDate.gte = fromDate;
    if (toDate) checkWhere.dueDate.lte = toDate;
  }

  const [entries, checks, groundingPeriods] = await Promise.all([
    prisma.dailyEntry.findMany({
      where: entryWhere,
      include: {
        createdBy: {
          select: { fullName: true, email: true },
        },
        approvedBy: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { entryDate: "asc" },
    }),
    prisma.checkSheet.findMany({
      where: checkWhere,
      orderBy: { dueDate: "asc" },
    }),
    (prisma as any).groundingPeriod.findMany({
      where: { equipmentId },
      orderBy: { fromDate: "asc" },
    }),
  ]);

  const now = new Date();

  const historyEntries = entries.map((entry) => ({
    id: entry.id,
    entryDate: entry.entryDate.toISOString(),
    hoursRun: Number(entry.hoursRun),
    createdBy: entry.createdBy?.fullName ?? null,
    createdByEmail: entry.createdBy?.email ?? null,
    approvedBy: entry.approvedBy?.fullName ?? null,
    approvedByEmail: entry.approvedBy?.email ?? null,
    approvedAt: entry.approvedAt ? entry.approvedAt.toISOString() : null,
  }));

  const historyChecks = checks.map((sheet) => {
    const effectiveStatus =
      sheet.status === CheckStatus.ISSUED && sheet.completedAt === null
        ? CheckStatus.ISSUED
        : sheet.status;

    const isMissed =
      !sheet.completedAt && effectiveStatus === CheckStatus.OVERDUE && sheet.dueDate < now;

    let pdfFilePath: string | null = null;
    if (sheet.pdfFilePath) {
      const relative = sheet.pdfFilePath.replace(/^\/+/, "").replace(/^uploads\//, "");
      pdfFilePath = `${UPLOADS_BASE_URL}/${relative.startsWith("checksheets/") ? relative : `checksheets/${relative}`}`;
    }

    return {
      id: sheet.id,
      checkCode: sheet.checkCode,
      dueHours: Number(sheet.dueHours),
      dueDate: sheet.dueDate.toISOString(),
      triggerType: sheet.triggerType,
      status: effectiveStatus,
      issuedAt: sheet.issuedAt ? sheet.issuedAt.toISOString() : null,
      completedAt: sheet.completedAt ? sheet.completedAt.toISOString() : null,
      completedHours: sheet.completedHours !== null ? Number(sheet.completedHours) : null,
      pdfFilePath,
      isMissed,
    };
  });

  const historyGroundings = groundingPeriods.map((p: any) => ({
    id: p.id,
    fromDate: p.fromDate.toISOString(),
    toDate: p.toDate ? p.toDate.toISOString() : null,
    reason: p.reason,
  }));

  return ok({
    equipment: {
      id: equipment.id,
      equipmentNumber: equipment.equipmentNumber,
      displayName: equipment.displayName,
      equipmentClass: equipment.equipmentClass,
      usageUnit: equipment.usageUnit,
      averageHoursPerDay: Number(equipment.averageHoursPerDay),
      currentHours: Number(equipment.currentHours),
      commissionedAt: equipment.commissionedAt ? equipment.commissionedAt.toISOString() : null,
      createdAt: equipment.createdAt.toISOString(),
    },
    entries: historyEntries,
    checks: historyChecks,
    groundingPeriods: historyGroundings,
  });
}

