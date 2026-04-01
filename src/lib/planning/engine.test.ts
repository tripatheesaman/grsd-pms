import { CheckStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  deriveDailyRatesFromCumulativeReadings,
  deriveForecastAverageHoursPerDay,
  determineStatus,
} from "./engine";

describe("deriveDailyRatesFromCumulativeReadings", () => {
  it("converts cumulative readings into per-day rates", () => {
    const rates = deriveDailyRatesFromCumulativeReadings([
      { entryDate: new Date("2026-01-01T00:00:00.000Z"), hoursRun: 100 },
      { entryDate: new Date("2026-01-03T00:00:00.000Z"), hoursRun: 112 },
      { entryDate: new Date("2026-01-04T00:00:00.000Z"), hoursRun: 118 },
    ]);

    expect(rates).toEqual([6, 6]);
  });
});

describe("deriveForecastAverageHoursPerDay", () => {
  it("recalibrates based on historical daily rates", () => {
    const forecast = deriveForecastAverageHoursPerDay({
      latestAverage: 4,
      historicalDailyHours: [6, 6, 7, 6, 8, 7],
    });

    expect(forecast).toBeGreaterThan(4);
    expect(forecast).toBeLessThan(8);
  });
});

describe("determineStatus", () => {
  const thresholds = {
    nearOffsetDays: 2,
    issueOffsetDays: 7,
    approachingOffsetDays: 30,
  };

  it("marks overdue only when days are negative", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");

    const overdue = determineStatus(200, 100, new Date("2026-03-31T23:59:59.000Z"), now, thresholds);
    const notOverdueAtNow = determineStatus(200, 100, new Date("2026-04-01T00:00:00.000Z"), now, thresholds);

    expect(overdue).toBe(CheckStatus.OVERDUE);
    expect(notOverdueAtNow).not.toBe(CheckStatus.OVERDUE);
  });

  it("clamps future due dates when hours are already exceeded", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");
    const status = determineStatus(
      100,
      120,
      new Date("2026-04-10T00:00:00.000Z"),
      now,
      thresholds,
    );

    expect(status).toBe(CheckStatus.NEAR_DUE);
  });

  it("applies day thresholds for issue required and predicted", () => {
    const now = new Date("2026-04-01T00:00:00.000Z");

    const issueRequired = determineStatus(100, 10, new Date("2026-04-05T00:00:00.000Z"), now, thresholds);
    const predicted = determineStatus(100, 10, new Date("2026-04-20T00:00:00.000Z"), now, thresholds);

    expect(issueRequired).toBe(CheckStatus.ISSUE_REQUIRED);
    expect(predicted).toBe(CheckStatus.PREDICTED);
  });
});
