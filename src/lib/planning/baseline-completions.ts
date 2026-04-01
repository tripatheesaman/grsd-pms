import { CheckStatus, TriggerType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function resolveHighestPriorityCode(
  targetHours: number,
  rules: Array<{ id: string; code: string; intervalHours: number }>,
) {
  const ordered = rules
    .filter((r) => Number(r.intervalHours) > 0)
    .sort((a, b) => Number(a.intervalHours) - Number(b.intervalHours) || a.code.localeCompare(b.code));
  if (ordered.length === 0) return null;
  const minInterval = Number(ordered[0]!.intervalHours);
  if (!Number.isFinite(minInterval) || minInterval <= 0) return null;
  const ratios = ordered.map((r) => Number(r.intervalHours) / minInterval);
  const contiguousCycle = ratios.every((v, idx) => Number.isFinite(v) && Math.abs(v - (idx + 1)) <= 1e-9);

  const isExactStep = Math.abs((targetHours / minInterval) - Math.round(targetHours / minInterval)) <= 1e-9;
  if (!isExactStep) return null;
  const step = Math.round(targetHours / minInterval);
  if (step <= 0) return null;
  if (contiguousCycle) {
    const index = (step - 1) % ordered.length;
    return ordered[index]!;
  }
  const eligible = ordered.filter((r) => {
    const interval = Number(r.intervalHours);
    if (!Number.isFinite(interval) || interval <= 0) return false;
    const ratio = targetHours / interval;
    return Math.abs(ratio - Math.round(ratio)) <= 1e-9;
  });
  if (eligible.length === 0) return null;
  return eligible.sort((a, b) => Number(b.intervalHours) - Number(a.intervalHours) || a.code.localeCompare(b.code))[0]!;
}

export async function ensureImpliedCompletedChecks(input: {
  equipmentId: string;
  baselineHours: number;
  baselineDate: Date;
}) {
  const rulesRaw = await prisma.checkRule.findMany({
    where: { equipmentId: input.equipmentId, isActive: true },
    select: { id: true, code: true, intervalHours: true },
  });
  const rules = rulesRaw.filter((r) => Number(r.intervalHours) > 0);
  if (rules.length === 0) return { created: 0 };

  const baseInterval = Math.min(...rules.map((r) => Number(r.intervalHours)).filter((v) => v > 0));
  if (!Number.isFinite(baseInterval) || baseInterval <= 0) return { created: 0 };

  const items: Array<{
    equipmentId: string;
    checkRuleId: string;
    checkCode: string;
    dueHours: number;
    dueDate: Date;
    triggerType: TriggerType;
    status: CheckStatus;
    completedAt: Date;
    completedHours: number;
  }> = [];

  const baselineHours = Math.floor(input.baselineHours);
  for (let h = baseInterval; h <= baselineHours; h += baseInterval) {
    const rule = resolveHighestPriorityCode(h, rules.map((r) => ({ id: r.id, code: r.code, intervalHours: Number(r.intervalHours) })));
    if (!rule) continue;
    items.push({
      equipmentId: input.equipmentId,
      checkRuleId: rule.id,
      checkCode: rule.code,
      dueHours: h,
      dueDate: input.baselineDate,
      triggerType: TriggerType.HOURS,
      status: CheckStatus.COMPLETED,
      completedAt: input.baselineDate,
      completedHours: h,
    });
  }

  if (items.length === 0) return { created: 0 };

  const result = await prisma.checkSheet.createMany({
    data: items,
    skipDuplicates: true,
  });

  return { created: result.count };
}

