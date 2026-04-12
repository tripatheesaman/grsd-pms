import { z } from "zod";
import { requireAccess, parseBody } from "@/lib/api/guard";
import { fail, ok } from "@/lib/api/response";
import { writeAuditLog } from "@/lib/audit/log";
import { prisma } from "@/lib/prisma";
import { permissionKeys } from "@/lib/security/permissions";
import { CheckStatus, UsageUnit } from "@prisma/client";
import { ensureImpliedCompletedChecks } from "@/lib/planning/baseline-completions";
import {
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
} from "@/lib/planning/engine";
import { toLifetimeReadings } from "@/lib/planning/meter-segment";
import { minimumReadingFromContext } from "@/lib/entries/reading-floor";

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
  previousCheckHours: z.number().nonnegative().optional(),
});

export async function GET(request: Request) {
  const access = await requireAccess({
    minRole: "USER",
    requiredPermission: permissionKeys.equipmentRead,
  });
  if ("error" in access) {
    return access.error;
  }

  const now = new Date();
  const url = new URL(request.url);
  const forEntryDate = url.searchParams.get("forEntryDate");
  let beforeEntryDate: Date;
  if (forEntryDate && /^\d{4}-\d{2}-\d{2}$/.test(forEntryDate)) {
    beforeEntryDate = new Date(`${forEntryDate}T00:00:00.000Z`);
  } else {
    beforeEntryDate = new Date(now);
    beforeEntryDate.setUTCHours(0, 0, 0, 0);
  }

  const items = await prisma.equipment.findMany({
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
      meterSegment: true,
      usageUnit: true,
      planningBaselineCheckCode: true,
      planningBaselineCheckDate: true,
      planningBaselineHours: true,
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

  const equipmentIds = items.map((item: any) => item.id);
  const recentApprovedEntries =
    equipmentIds.length > 0
      ? await prisma.dailyEntry.findMany({
          where: {
            equipmentId: { in: equipmentIds },
            status: "APPROVED",
          },
          select: {
            equipmentId: true,
            entryDate: true,
            hoursRun: true,
            meterSegment: true,
          },
          orderBy: [{ equipmentId: "asc" }, { entryDate: "asc" }],
        })
      : [];
  const segmentGroups =
    equipmentIds.length > 0
      ? await prisma.dailyEntry.groupBy({
          by: ["equipmentId", "meterSegment"],
          where: { equipmentId: { in: equipmentIds }, status: "APPROVED" },
          _max: { hoursRun: true },
        })
      : [];

  const segmentMaxByEquipment = new Map<string, Map<number, number>>();
  for (const g of segmentGroups) {
    if (g._max.hoursRun == null) continue;
    const inner = segmentMaxByEquipment.get(g.equipmentId) ?? new Map<number, number>();
    inner.set(g.meterSegment, Number(g._max.hoursRun));
    segmentMaxByEquipment.set(g.equipmentId, inner);
  }

  const entriesByEquipment = new Map<
    string,
    Array<{ entryDate: Date; hoursRun: number; meterSegment: number }>
  >();
  for (const entry of recentApprovedEntries) {
    const current = entriesByEquipment.get(entry.equipmentId) ?? [];
    current.push({
      entryDate: entry.entryDate,
      hoursRun: Number(entry.hoursRun),
      meterSegment: entry.meterSegment,
    });
    entriesByEquipment.set(entry.equipmentId, current);
  }

  const equipmentHasApproved = new Set(recentApprovedEntries.map((e) => e.equipmentId));
  const approvedByEquipmentSegment = new Map<
    string,
    Array<{ entryDate: Date; hoursRun: number }>
  >();
  for (const entry of recentApprovedEntries) {
    const k = `${entry.equipmentId}:${entry.meterSegment}`;
    const arr = approvedByEquipmentSegment.get(k) ?? [];
    arr.push({ entryDate: entry.entryDate, hoursRun: Number(entry.hoursRun) });
    approvedByEquipmentSegment.set(k, arr);
  }

  function lifetimeReadingsForEquipment(equipmentId: string) {
    const raw = entriesByEquipment.get(equipmentId) ?? [];
    const segMap = segmentMaxByEquipment.get(equipmentId) ?? new Map<number, number>();
    return toLifetimeReadings(raw, segMap);
  }

  return ok(
    items.map((item: any) => ({
      ...(function () {
        const readings = lifetimeReadingsForEquipment(item.id);
        if (readings.length < 2) {
          return {
            averageHoursPerDay: Number(item.averageHoursPerDay),
          };
        }
        const dailyRates = deriveDailyRatesFromCumulativeReadings(readings);
        if (dailyRates.length === 0) {
          return {
            averageHoursPerDay: Number(item.averageHoursPerDay),
          };
        }
        const recalculatedAverage = deriveForecastAverageHoursPerDay({
          latestAverage: 0,
          historicalDailyHours: dailyRates,
        });
        return {
          averageHoursPerDay: Number(recalculatedAverage.toFixed(2)),
        };
      })(),
      ...(function () {
        const avgValue = (function () {
          const readings = lifetimeReadingsForEquipment(item.id);
          if (readings.length < 2) return Number(item.averageHoursPerDay);
          const dailyRates = deriveDailyRatesFromCumulativeReadings(readings);
          if (dailyRates.length === 0) return Number(item.averageHoursPerDay);
          return Number(
            deriveForecastAverageHoursPerDay({
              latestAverage: 0,
              historicalDailyHours: dailyRates,
            }).toFixed(2),
          );
        })();
        return {
          isAvgHoursMissing: !Number.isFinite(avgValue) || avgValue <= 0,
          hasPreviousCheckConfigured:
            item.planningBaselineCheckCode != null &&
            item.planningBaselineCheckDate != null &&
            item.planningBaselineHours != null,
        };
      })(),
      id: item.id,
      equipmentNumber: item.equipmentNumber,
      displayName: item.displayName,
      equipmentClass: item.equipmentClass,
      currentHours: Number(item.currentHours),
      nextEntryMinimumReading: minimumReadingFromContext(
        (approvedByEquipmentSegment.get(`${item.id}:${item.meterSegment}`) ?? []).filter(
          (r) => r.entryDate < beforeEntryDate,
        ),
        beforeEntryDate,
        equipmentHasApproved.has(item.id),
        Number(item.currentHours),
      ),
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
    (parsed.data.previousCheckCode || parsed.data.previousCheckDate || parsed.data.previousCheckHours !== undefined) &&
    !(parsed.data.previousCheckCode && parsed.data.previousCheckDate && parsed.data.previousCheckHours !== undefined)
  ) {
    return fail("BAD_REQUEST", "Previous check code, date, and hours must all be provided together", 400);
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

  if (parsed.data.previousCheckCode && parsed.data.previousCheckDate && parsed.data.previousCheckHours !== undefined) {
    const previousCheckRule = equipment.checkRules.find(
      (rule) => rule.code === parsed.data.previousCheckCode
    );

    if (previousCheckRule) {
      const previousCheckDate = new Date(`${parsed.data.previousCheckDate}T00:00:00.000Z`);
      const completedHours = parsed.data.previousCheckHours;

      await prisma.checkSheet.create({
        data: {
          equipmentId: equipment.id,
          checkRuleId: previousCheckRule.id,
          checkCode: previousCheckRule.code,
          dueHours: completedHours,
          dueDate: previousCheckDate,
          triggerType: "HOURS",
          status: CheckStatus.COMPLETED,
          completedAt: previousCheckDate,
          completedHours,
        },
      });

      await ensureImpliedCompletedChecks({
        equipmentId: equipment.id,
        baselineHours: completedHours,
        baselineDate: previousCheckDate,
      }).catch(() => null);
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
