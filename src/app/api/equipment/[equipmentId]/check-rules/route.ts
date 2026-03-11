import { z } from "zod";
import { access as fsAccess, readdir } from "fs/promises";
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

let systemConfigCache: {
  approachingOffsetHours: number;
  issueOffsetHours: number;
  nearOffsetHours: number;
  timestamp: number;
} | null = null;

const CONFIG_CACHE_TTL = 60000;

async function getSystemThresholds() {
  const now = Date.now();
  if (systemConfigCache && (now - systemConfigCache.timestamp) < CONFIG_CACHE_TTL) {
    return {
      approachingOffsetHours: systemConfigCache.approachingOffsetHours,
      issueOffsetHours: systemConfigCache.issueOffsetHours,
      nearOffsetHours: systemConfigCache.nearOffsetHours,
    };
  }

  const [approachingConfig, issueConfig, nearConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "approaching_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "issue_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "near_offset_hours" } }).catch(() => null),
  ]);

  const thresholds = {
    approachingOffsetHours: approachingConfig ? Number(approachingConfig.value) : 120,
    issueOffsetHours: issueConfig ? Number(issueConfig.value) : 40,
    nearOffsetHours: nearConfig ? Number(nearConfig.value) : 10,
  };

  systemConfigCache = {
    ...thresholds,
    timestamp: now,
  };

  return thresholds;
}

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
    select: {
      equipmentNumber: true,
    },
  });

  if (!equipment) {
    return fail("NOT_FOUND", "Equipment not found", 404);
  }

  const rules = await prisma.checkRule.findMany({
    where: { equipmentId },
    orderBy: { code: "asc" },
  });

  const safeEquipment = equipment.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  const equipmentNumberAsInt = Number.parseInt(equipment.equipmentNumber, 10);
  const equipmentNumberIsNumeric =
    Number.isFinite(equipmentNumberAsInt) && String(equipmentNumberAsInt) === equipment.equipmentNumber.trim();

  // Support both naming conventions:
  // - Single equipment: 1005_A.pdf (existing behavior)
  // - Range: 1003-1004_A.pdf (new behavior)
  const checksheetsDir = buildUploadPath("checksheets");
  let rangeTemplates: Array<{ from: number; to: number; code: string; fileName: string }> = [];
  if (equipmentNumberIsNumeric) {
    try {
      const files = await readdir(checksheetsDir);
      rangeTemplates = files
        .map((fileName) => {
          const m = /^(\d+)-(\d+)_([A-Za-z])\.pdf$/.exec(fileName);
          if (!m) return null;
          const from = Number.parseInt(m[1]!, 10);
          const to = Number.parseInt(m[2]!, 10);
          const code = m[3]!.toUpperCase();
          if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
          if (from > to) return null;
          return { from, to, code, fileName };
        })
        .filter(Boolean) as Array<{ from: number; to: number; code: string; fileName: string }>;

      // Prefer the most specific range (smallest span), then lowest start.
      rangeTemplates.sort((a, b) => (a.to - a.from) - (b.to - b.from) || a.from - b.from);
    } catch {
      // If directory doesn't exist / unreadable, treat as no range templates.
      rangeTemplates = [];
    }
  }

  const templateStatuses = await Promise.all(
    rules.map(async (rule) => {
      const safeCode = rule.code.toUpperCase();
      const directFileName = `${safeEquipment}_${safeCode}.pdf`;
      const directAbsolutePath = buildUploadPath("checksheets", directFileName);
      try {
        await fsAccess(directAbsolutePath, constants.F_OK);
        return `${UPLOADS_BASE_URL}/checksheets/${directFileName}`;
      } catch {
        if (!equipmentNumberIsNumeric) return null;
        const rangeMatch = rangeTemplates.find(
          (t) => t.code === safeCode && equipmentNumberAsInt >= t.from && equipmentNumberAsInt <= t.to
        );
        return rangeMatch ? `${UPLOADS_BASE_URL}/checksheets/${rangeMatch.fileName}` : null;
      }
    })
  );

  return ok(
    rules.map((rule, index) => ({
      id: rule.id,
      code: rule.code,
      intervalHours: rule.intervalHours,
      approachingOffsetHours: rule.approachingOffsetHours,
      issueOffsetHours: rule.issueOffsetHours,
      nearOffsetHours: rule.nearOffsetHours,
      intervalTimeValue: rule.intervalTimeValue,
      intervalTimeUnit: rule.intervalTimeUnit,
      isActive: rule.isActive,
      templatePdfPath: templateStatuses[index],
    }))
  );
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

  const thresholds = await getSystemThresholds();

  const rule = await prisma.checkRule.create({
    data: {
      equipmentId,
      code: parsed.data.code,
      intervalHours: parsed.data.intervalHours,
      intervalTimeValue: parsed.data.intervalTimeValue ?? null,
      intervalTimeUnit: parsed.data.intervalTimeUnit ?? null,
      approachingOffsetHours: thresholds.approachingOffsetHours,
      issueOffsetHours: thresholds.issueOffsetHours,
      nearOffsetHours: thresholds.nearOffsetHours,
    },
  });

  writeAuditLog({
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
  }).catch(() => null);

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
