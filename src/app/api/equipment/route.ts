import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { CheckStatus, UsageUnit } from "@prisma/client";

const ruleSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(1)
    .regex(/^[A-Z]$/),
  intervalHours: z.number().int().positive(),
  approachingOffsetHours: z.number().int().nonnegative(),
  issueOffsetHours: z.number().int().nonnegative(),
  nearOffsetHours: z.number().int().nonnegative(),
  intervalTimeValue: z.number().int().positive().optional(),
  intervalTimeUnit: z.enum(["MONTHS", "YEARS"]).optional(),
}).refine(
  (data) =>
    (!data.intervalTimeValue && !data.intervalTimeUnit) ||
    (data.intervalTimeValue && data.intervalTimeUnit),
  {
    message: "Both intervalTimeValue and intervalTimeUnit are required when configuring a time interval",
    path: ["intervalTimeValue"],
  },
);

const createEquipmentSchema = z.object({
  equipmentNumber: z.string().min(1).max(40),
  displayName: z.string().min(2).max(120),
  equipmentClass: z.string().min(2).max(40).optional(),
  averageHoursPerDay: z.number().nonnegative(),
  currentHours: z.number().nonnegative(),
  commissionedAt: z.string().datetime().optional(),
  usageUnit: z.nativeEnum(UsageUnit).default(UsageUnit.HOURS),
  checkRules: z.array(ruleSchema).min(1).max(26),
  previousCheckCode: z.string().regex(/^[A-Z]$/).optional(),
  previousCheckDate: z.string().optional(),
});

export async function GET() {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const now = new Date();

  const items = await (prisma as any).equipment.findMany({
    orderBy: {
      equipmentNumber: "asc",
    },
    select: {
      id: true,
      equipmentNumber: true,
      displayName: true,
      equipmentClass: true,
      averageHoursPerDay: true,
      currentHours: true,
      usageUnit: true,
      groundingPeriods: {
        where: {
          fromDate: { lte: now },
          OR: [{ toDate: null }, { toDate: { gte: now } }],
        },
        select: {
          id: true,
        },
      },
      checkRules: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
        },
      },
    },
  });

  return ok(
    items.map((item: any) => ({
      id: item.id,
      equipmentNumber: item.equipmentNumber,
      displayName: item.displayName,
      equipmentClass: item.equipmentClass,
      averageHoursPerDay: Number(item.averageHoursPerDay),
      currentHours: Number(item.currentHours),
      usageUnit: item.usageUnit,
      activeRuleCount: item.checkRules.length,
      hasActiveGrounding: (item.groundingPeriods ?? []).length > 0,
    })),
  );
}

export async function POST(request: Request) {
  const access = await requireAccess({
    minRole: "ADMIN",
    requiredPermission: permissionKeys.equipmentManage,
  });
  if ("error" in access) {
    return access.error;
  }

  const parsed = await parseBody(request, createEquipmentSchema);
  if ("error" in parsed) {
    return parsed.error;
  }

  const existing = await prisma.equipment.findUnique({
    where: {
      equipmentNumber: parsed.data.equipmentNumber,
    },
  });
  if (existing) {
    return fail("CONFLICT", "Equipment number already exists", 409);
  }

  const uniqueCodes = new Set(parsed.data.checkRules.map((rule) => rule.code));
  if (uniqueCodes.size !== parsed.data.checkRules.length) {
    return fail("BAD_REQUEST", "Duplicate check code for equipment", 400);
  }

  if (
    (parsed.data.previousCheckCode && !parsed.data.previousCheckDate) ||
    (!parsed.data.previousCheckCode && parsed.data.previousCheckDate)
  ) {
    return fail("BAD_REQUEST", "Previous check code and date must be provided together", 400);
  }

  if (parsed.data.previousCheckCode) {
    const hasMatchingRule = parsed.data.checkRules.some(
      (rule) => rule.code === parsed.data.previousCheckCode
    );
    if (!hasMatchingRule) {
      return fail("BAD_REQUEST", "Previous check code must match one of the check rules", 400);
    }
  }

  const equipment = await prisma.equipment.create({
    data: {
      equipmentNumber: parsed.data.equipmentNumber,
      displayName: parsed.data.displayName,
      equipmentClass: parsed.data.equipmentClass ?? "GENERAL",
      averageHoursPerDay: parsed.data.averageHoursPerDay,
      currentHours: parsed.data.currentHours,
      usageUnit: parsed.data.usageUnit,
      commissionedAt: parsed.data.commissionedAt
        ? new Date(parsed.data.commissionedAt)
        : null,
      checkRules: {
        create: parsed.data.checkRules.map((rule) => ({
          code: rule.code,
          intervalHours: rule.intervalHours,
          approachingOffsetHours: rule.approachingOffsetHours,
          issueOffsetHours: rule.issueOffsetHours,
          nearOffsetHours: rule.nearOffsetHours,
          intervalTimeValue: rule.intervalTimeValue ?? null,
          intervalTimeUnit: rule.intervalTimeUnit ?? null,
        })),
      },
    },
    include: {
      checkRules: true,
    },
  });

  if (parsed.data.previousCheckCode && parsed.data.previousCheckDate) {
    const previousCheckRule = equipment.checkRules.find(
      (rule) => rule.code === parsed.data.previousCheckCode
    );

    if (previousCheckRule) {
      const previousCheckDate = new Date(`${parsed.data.previousCheckDate}T00:00:00.000Z`);
      const dueHours = previousCheckRule.intervalHours;

      await prisma.checkSheet.create({
        data: {
          equipmentId: equipment.id,
          checkRuleId: previousCheckRule.id,
          checkCode: previousCheckRule.code,
          dueHours,
          dueDate: previousCheckDate,
          triggerType: "HOURS",
          status: CheckStatus.COMPLETED,
          completedAt: previousCheckDate,
        },
      });
    }
  }

  await writeAuditLog({
    userId: access.user.id,
    action: "equipment.create",
    entityType: "Equipment",
    entityId: equipment.id,
    payload: {
      equipmentNumber: equipment.equipmentNumber,
      displayName: equipment.displayName,
      checkRules: parsed.data.checkRules.length,
    },
    request,
  });

  return ok(
    {
      id: equipment.id,
      equipmentNumber: equipment.equipmentNumber,
      displayName: equipment.displayName,
    },
    201
  );
}
