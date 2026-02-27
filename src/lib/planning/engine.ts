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

export type PlannedCheck = {
  checkRuleId: string;
  checkCode: string;
  dueHours: number;
  dueDate: Date;
  triggerType: TriggerType;
  status: CheckStatus;
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

function resolveHighestPriorityRule(targetHours: number, rules: RuleShape[]) {
  const eligible = rules.filter((rule) => {
    const interval = Number(rule.intervalHours);
    return interval > 0 && targetHours % interval === 0;
  });
  if (eligible.length === 0) {
    return null;
  }
  return eligible.sort((a, b) => Number(b.intervalHours) - Number(a.intervalHours))[0];
}

function findNextMilestoneHours(currentHours: number, rules: RuleShape[]) {
  let nextHours = Number.POSITIVE_INFINITY;
  for (const rule of rules) {
    const interval = Number(rule.intervalHours);
    if (interval <= 0) continue;
    const candidate = Math.floor(currentHours / interval) * interval + interval;
    if (candidate < nextHours && candidate > currentHours) {
      nextHours = candidate;
    }
  }
  if (!Number.isFinite(nextHours)) {
    return null;
  }
  return nextHours;
}

export function determineStatus(
  dueHours: number,
  currentHours: number,
  issueDate: Date,
  now: Date,
  thresholds: {
    nearOffsetHours: number;
    issueOffsetHours: number;
    approachingOffsetHours: number;
  },
) {
  if (now > issueDate) {
    return CheckStatus.OVERDUE;
  }
  const remainingHours = dueHours - currentHours;
  if (remainingHours <= thresholds.nearOffsetHours) {
    return CheckStatus.NEAR_DUE;
  }
  if (remainingHours <= thresholds.issueOffsetHours) {
    return CheckStatus.ISSUE_REQUIRED;
  }
  if (remainingHours <= thresholds.approachingOffsetHours) {
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

  const low = quantile(series, 0.1);
  const high = quantile(series, 0.9);
  const winsorized = series.map((value) => Math.min(high, Math.max(low, value)));
  const weighted = winsorized.reduce(
    (accumulator, value, index) => {
      const weight = index + 1;
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
  return input.latestAverage * 0.35 + recentWeightedAverage * 0.65;
}

export function buildYearlyPlan(input: {
  currentHours: number;
  averageHoursPerDay: number;
  rules: RuleShape[];
  now?: Date;
  anchorDate?: Date;
  year: number;
  startHours?: number;
  thresholds?: {
    nearOffsetHours: number;
    issueOffsetHours: number;
    approachingOffsetHours: number;
  };
}) {
  const now = input.now ?? new Date();
  const anchorDate = input.anchorDate ?? now;
  const rules = input.rules.filter((rule) => rule.intervalHours > 0);
  if (rules.length === 0 || input.averageHoursPerDay <= 0) {
    return [];
  }

  const endOfYear = new Date(input.year, 11, 31, 23, 59, 59, 999);
  const plans: Array<PlannedCheck & { week: number }> = [];

  const startHours = input.startHours ?? input.currentHours;
  let simulatedHours = startHours;
  let referenceDate = anchorDate;
  let loops = 0;

  while (referenceDate <= endOfYear && loops < 800) {
    loops += 1;
    const nextMilestone = findNextMilestoneHours(simulatedHours, rules);
    if (nextMilestone === null) {
      break;
    }
    const rule = resolveHighestPriorityRule(nextMilestone, rules);
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
    const thresholds = input.thresholds ?? {
      nearOffsetHours: 10,
      issueOffsetHours: 40,
      approachingOffsetHours: 120,
    };
    const status = determineStatus(nextMilestone, input.currentHours, issueDate, now, thresholds);

    plans.push({
      checkRuleId: rule.id,
      checkCode: rule.code,
      dueHours: nextMilestone,
      dueDate: issueDate,
      triggerType,
      status,
      week: isoWeek(issueDate),
    });

    simulatedHours = nextMilestone;
    referenceDate = issueDate;
  }

  return plans;
}
