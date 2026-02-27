import { deriveForecastAverageHoursPerDay } from "@/lib/planning/engine";

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return 0;
  }
  const m = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function buildForecastMetrics(
  historicalDailyHours: number[],
  currentAverageHoursPerDay: number,
) {
  const values = historicalDailyHours.filter((value) => Number.isFinite(value) && value > 0);
  const forecastAverage = deriveForecastAverageHoursPerDay({
    latestAverage: currentAverageHoursPerDay,
    historicalDailyHours: values,
  });

  const deviation = standardDeviation(values);
  const confidenceLow = Math.max(0, forecastAverage - deviation);
  const confidenceHigh = forecastAverage + deviation;

  const errors: number[] = [];
  const percentageErrors: number[] = [];
  const startIndex = Math.max(7, values.length - 30);
  for (let index = startIndex; index < values.length; index += 1) {
    const historySlice = values.slice(Math.max(0, index - 45), index);
    if (historySlice.length < 5) {
      continue;
    }
    const predicted = deriveForecastAverageHoursPerDay({
      latestAverage: currentAverageHoursPerDay,
      historicalDailyHours: historySlice,
    });
    const actual = values[index];
    const error = Math.abs(actual - predicted);
    errors.push(error);
    if (actual > 0) {
      percentageErrors.push((error / actual) * 100);
    }
  }

  return {
    forecastAverageHoursPerDay: Number(forecastAverage.toFixed(2)),
    confidenceLowHoursPerDay: Number(confidenceLow.toFixed(2)),
    confidenceHighHoursPerDay: Number(confidenceHigh.toFixed(2)),
    meanAbsoluteError: Number(mean(errors).toFixed(2)),
    meanAbsolutePercentageError: Number(mean(percentageErrors).toFixed(2)),
    sampleSize: values.length,
  };
}
