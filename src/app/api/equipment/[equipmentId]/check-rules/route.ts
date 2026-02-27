import { z } from "zod";
import { access as fsAccess } from "fs/promises";
import { constants } from "fs";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { buildUploadPath } from "@/lib/uploads";
import { UPLOADS_BASE_URL } from "@/lib/config/app-config";

const createCheckRuleSchema = z.object({
  code: z.string().min(1).max(1).regex(/^[A-Z]$/),
  intervalHours: z.number().int().positive(),
  intervalTimeValue: z.number().int().positive().optional(),
  intervalTimeUnit: z.enum(["MONTHS", "YEARS"]).optional(),
});

const updateCheckRuleSchema = z.object({
  intervalHours: z.number().int().positive().optional(),
  intervalTimeValue: z.number().int().positive().optional().nullable(),
  intervalTimeUnit: z.enum(["MONTHS", "YEARS"]).optional().nullable(),
  isActive: z.boolean().optional(),
}).refine(
  (data) =>
    (!data.intervalTimeValue && !data.intervalTimeUnit) ||
    (data.intervalTimeValue && data.intervalTimeUnit),
  {
    message: "Both intervalTimeValue and intervalTimeUnit are required when configuring a time interval",
    path: ["intervalTimeValue"],
  },
);

type RouteContext = {
  params: Promise<{ equipmentId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const rules = await prisma.checkRule.findMany({
    where: { equipmentId },
    orderBy: { code: "asc" },
  });

  const rulesWithTemplateStatus = await Promise.all(
    rules.map(async (rule) => {
      const safeEquipment = equipment.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
      const safeCode = rule.code.toUpperCase();
      const templateFileName = `${safeEquipment}_${safeCode}.pdf`;
      const absolutePath = buildUploadPath("checksheets", templateFileName);

      let templatePdfPath: string | null = null;
      try {
        await fsAccess(absolutePath, constants.F_OK);
        templatePdfPath = `${UPLOADS_BASE_URL}/checksheets/${templateFileName}`;
      } catch {
        templatePdfPath = null;
      }

      return {
        id: rule.id,
        code: rule.code,
        intervalHours: rule.intervalHours,
        approachingOffsetHours: rule.approachingOffsetHours,
        issueOffsetHours: rule.issueOffsetHours,
        nearOffsetHours: rule.nearOffsetHours,
        intervalTimeValue: rule.intervalTimeValue,
        intervalTimeUnit: rule.intervalTimeUnit,
        isActive: rule.isActive,
        templatePdfPath,
      };
    })
  );

  return ok(rulesWithTemplateStatus);
}

export async function POST(request: Request, context: RouteContext) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, createCheckRuleSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const { equipmentId } = await context.params;
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const existing = await prisma.checkRule.findUnique({
    where: {
      equipmentId_code: {
        equipmentId,
        code: parsed.data.code,
      },
    },
  });

  if (existing) {
    return fail("CONFLICT", "Check rule with this code already exists", 409);
  }

  const [approachingConfig, issueConfig, nearConfig] = await Promise.all([
    (prisma as any).systemConfig?.findUnique({ where: { key: "approaching_offset_hours" } }).catch(() => null),
    (prisma as any).systemConfig?.findUnique({ where: { key: "issue_offset_hours" } }).catch(() => null),
    (prisma as any).systemConfig?.findUnique({ where: { key: "near_offset_hours" } }).catch(() => null),
  ]);

  const approachingOffsetHours = approachingConfig ? Number(approachingConfig.value) : 120;
  const issueOffsetHours = issueConfig ? Number(issueConfig.value) : 40;
  const nearOffsetHours = nearConfig ? Number(nearConfig.value) : 10;

  const rule = await prisma.checkRule.create({
    data: {
      equipmentId,
      code: parsed.data.code,
      intervalHours: parsed.data.intervalHours,
      intervalTimeValue: parsed.data.intervalTimeValue ?? null,
      intervalTimeUnit: parsed.data.intervalTimeUnit ?? null,
      approachingOffsetHours,
      issueOffsetHours,
      nearOffsetHours,
    },
  });

  await writeAuditLog({
    userId: access.user.id,
    action: "checkRule.create",
    entityType: "CheckRule",
    entityId: rule.id,
    payload: {
      equipmentId,
      code: rule.code,
      intervalHours: rule.intervalHours,
    },
    request,
  });

  return ok(
    {
      id: rule.id,
      code: rule.code,
      intervalHours: rule.intervalHours,
      approachingOffsetHours: rule.approachingOffsetHours,
      issueOffsetHours: rule.issueOffsetHours,
      nearOffsetHours: rule.nearOffsetHours,
      isActive: rule.isActive,
    },
    201
  );
}
