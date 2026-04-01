import { CheckRule, CheckStatus, TriggerType } from "@prisma/client";

type RuleShape = Pick<
  CheckRule,
  | "id"
  | "code"
  | "intervalHours"
  | "intervalTimeValue"
  | "intervalTimeUnit"
  | "approachingOffsetHours"
  | "issueOffsetHours"
  | "nearOffsetHours"
>;

type PlanningProfile = {
  rules: RuleShape[];
  minInterval: number;
  mode: "cycle" | "divisor";
};

export type PlannedCheck = {
  checkRuleId: string;
  checkCode: string;
  dueHours: number;
  dueDate: Date;
  triggerType: TriggerType;
};

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function addMonths(date: Date, months: number) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + months);
  return value;
}

function isoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function cycleModulo(value: number, mod: number) {
  const r = value % mod;
  return r < 0 ? r + mod : r;
}

function buildPlanningProfile(rules: RuleShape[]): PlanningProfile | null {
  const ordered = [...rules]
    .filter((rule) => Number(rule.intervalHours) > 0)
    .sort((a, b) => Number(a.intervalHours) - Number(b.intervalHours) || a.code.localeCompare(b.code));
  if (ordered.length === 0) return null;

  const minInterval = Number(ordered[0]!.intervalHours);
  if (!Number.isFinite(minInterval) || minInterval <= 0) return null;

  const normalized = ordered.map((rule) => Number(rule.intervalHours) / minInterval);
  const isIntegerSteps = normalized.every((v) => Number.isFinite(v) && Math.abs(v - Math.round(v)) <= 1e-9);
  const integerSteps = normalized.map((v) => Math.round(v));
  const contiguousCycle = isIntegerSteps && integerSteps.every((v, idx) => v === idx + 1);

  return {
    rules: ordered,
    minInterval,
    mode: contiguousCycle ? "cycle" : "divisor",
  };
}

function resolveRuleDivisorMode(rules: RuleShape[], milestoneHours: number) {
  const eligible = rules.filter((rule) => {
    const interval = Number(rule.intervalHours);
    if (!Number.isFinite(interval) || interval <= 0) return false;
    const ratio = milestoneHours / interval;
    return Math.abs(ratio - Math.round(ratio)) <= 1e-9;
  });
  if (eligible.length === 0) return null;
  return eligible.sort((a, b) => Number(b.intervalHours) - Number(a.intervalHours) || a.code.localeCompare(b.code))[0]!;
}

export function determineStatus(
  dueHours: number,
  currentHours: number,
  issueDate: Date,
  now: Date,
  thresholds: {
    nearOffsetDays: number;
    issueOffsetDays: number;
    approachingOffsetDays: number;
  },
) {
  // If hours are already reached, the due point cannot remain in the future.
  const effectiveIssueDate =
    currentHours >= dueHours && issueDate.getTime() > now.getTime()
      ? new Date(now)
      : issueDate;

  const dayMs = 24 * 60 * 60 * 1000;
  const daysToDue = (effectiveIssueDate.getTime() - now.getTime()) / dayMs;

  // Overdue is strictly date-based.
  if (daysToDue < 0) {
    return CheckStatus.OVERDUE;
  }
  if (daysToDue <= thresholds.nearOffsetDays) {
    return CheckStatus.NEAR_DUE;
  }
  if (daysToDue <= thresholds.issueOffsetDays) {
    return CheckStatus.ISSUE_REQUIRED;
  }
  if (daysToDue <= thresholds.approachingOffsetDays) {
    return CheckStatus.PREDICTED;
  }
  return CheckStatus.PREDICTED;
}

export function deriveAverageHoursPerDay(
  latestAverage: number,
  enteredHours: number,
  smoothing = 0.25,
) {
  if (latestAverage <= 0) {
    return enteredHours;
  }
  return latestAverage * (1 - smoothing) + enteredHours * smoothing;
}

export function deriveDailyRatesFromCumulativeReadings(
  readings: Array<{ entryDate: Date; hoursRun: number }>,
) {
  if (readings.length < 2) return [];
  const sorted = [...readings].sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());
  const rates: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const deltaHours = Number(curr.hoursRun) - Number(prev.hoursRun);
    if (!Number.isFinite(deltaHours) || deltaHours <= 0) continue;
    const dayMs = 24 * 60 * 60 * 1000;
    const dayDiffRaw = (curr.entryDate.getTime() - prev.entryDate.getTime()) / dayMs;
    const dayDiff = Math.max(1, Math.round(dayDiffRaw));
    const rate = deltaHours / dayDiff;
    if (Number.isFinite(rate) && rate > 0) {
      rates.push(rate);
    }
  }
  return rates;
}

function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const floor = Math.floor(index);
  const ceil = Math.ceil(index);
  if (floor === ceil) {
    return sorted[floor];
  }
  return sorted[floor] + (sorted[ceil] - sorted[floor]) * (index - floor);
}

export function deriveForecastAverageHoursPerDay(input: {
  latestAverage: number;
  historicalDailyHours: number[];
  upcomingEnteredHours?: number;
}) {
  const series = input.historicalDailyHours
    .filter((value) => Number.isFinite(value) && value > 0)
    .slice(-45);
  if (input.upcomingEnteredHours && input.upcomingEnteredHours > 0) {
    series.push(input.upcomingEnteredHours);
  }
  if (series.length === 0) {
    return Math.max(0, input.latestAverage);
  }

  const low = quantile(series, 0.15);
  const high = quantile(series, 0.85);
  const winsorized = series.map((value) => Math.min(high, Math.max(low, value)));
  const tau = 10;
  const weighted = winsorized.reduce(
    (accumulator, value, index) => {
      const recency = winsorized.length - 1 - index;
      const weight = Math.exp(-recency / tau);
      return {
        sum: accumulator.sum + value * weight,
        weights: accumulator.weights + weight,
      };
    },
    { sum: 0, weights: 0 },
  );
  const recentWeightedAverage =
    weighted.weights > 0 ? weighted.sum / weighted.weights : winsorized[winsorized.length - 1];
  if (input.latestAverage <= 0) {
    return recentWeightedAverage;
  }
  const mean = winsorized.reduce((acc, v) => acc + v, 0) / winsorized.length;
  const variance = winsorized.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / winsorized.length;
  const stdev = Math.sqrt(Math.max(0, variance));
  const volatility = mean > 0 ? Math.min(1, stdev / mean) : 1;
  const sampleStrength = winsorized.length / (winsorized.length + 8);
  const adaptiveNewWeight = Math.min(0.9, Math.max(0.45, 0.45 + sampleStrength * 0.4 - volatility * 0.2));
  return input.latestAverage * (1 - adaptiveNewWeight) + recentWeightedAverage * adaptiveNewWeight;
}

export function buildYearlyPlan(input: {
  currentHours: number;
  averageHoursPerDay: number;
  rules: RuleShape[];
  now?: Date;
  anchorDate?: Date;
  year: number;
  startHours?: number;
  startingCheckCode?: string | null;
  thresholds?: {
    nearOffsetDays: number;
    issueOffsetDays: number;
    approachingOffsetDays: number;
  };
}) {
  const now = input.now ?? new Date();
  const anchorDate = input.anchorDate ?? now;
  const profile = buildPlanningProfile(input.rules);
  if (!profile || input.averageHoursPerDay <= 0) {
    return [];
  }

  const endOfYear = new Date(input.year, 11, 31, 23, 59, 59, 999);
  const plans: Array<PlannedCheck & { week: number }> = [];

  const minInterval = profile.minInterval;
  const recurringRules = profile.rules;

  const startHours = input.startHours ?? input.currentHours;
  let simulatedHours = startHours;
  let referenceDate = anchorDate;
  let loops = 0;

  const cycleRules = recurringRules;
  const cycleLength = cycleRules.length;
  let cycleIndex =
    profile.mode === "cycle" && input.startingCheckCode
      ? cycleRules.findIndex((r) => r.code === input.startingCheckCode)
      : -1;

  while (referenceDate <= endOfYear && loops < 800 && recurringRules.length > 0) {
    loops += 1;
    const ratio = simulatedHours / minInterval;
    const nextStep = Math.floor(ratio + 1e-9) + 1;
    const nextMilestone = nextStep * minInterval;
    if (!Number.isFinite(nextMilestone) || nextMilestone <= simulatedHours) {
      break;
    }

    let rule: RuleShape | null = null;
    if (profile.mode === "cycle") {
      if (cycleIndex >= 0) {
        cycleIndex = (cycleIndex + 1) % cycleLength;
      } else {
        cycleIndex = cycleModulo(nextStep - 1, cycleLength);
      }
      rule = cycleRules[cycleIndex] ?? null;
    } else {
      rule = resolveRuleDivisorMode(recurringRules, nextMilestone);
    }

    if (!rule) {
      simulatedHours = nextMilestone;
      continue;
    }

    const deltaHours = nextMilestone - simulatedHours;
    const daysByHours = Math.max(0, deltaHours / input.averageHoursPerDay);
    const hoursDate = addDays(referenceDate, Math.ceil(daysByHours));
    let triggerType: TriggerType = TriggerType.HOURS;
    let issueDate = hoursDate;

    if (rule.intervalTimeValue && rule.intervalTimeValue > 0 && rule.intervalTimeUnit) {
      const months =
        rule.intervalTimeUnit === "MONTHS"
          ? rule.intervalTimeValue
          : rule.intervalTimeValue * 12;
      const timeDate = addMonths(referenceDate, months);
      if (timeDate < hoursDate) {
        triggerType = TriggerType.CALENDAR;
        issueDate = timeDate;
      }
    }
    if (issueDate > endOfYear) {
      break;
    }

    plans.push({
      checkRuleId: rule.id,
      checkCode: rule.code,
      dueHours: nextMilestone,
      dueDate: issueDate,
      triggerType,
      week: isoWeek(issueDate),
    });

    simulatedHours = nextMilestone;
    referenceDate = issueDate;
  }

  return plans;
}
