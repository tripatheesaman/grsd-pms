import type { Prisma } from "@prisma/client";

export type SegmentMaxGroup = {
  meterSegment: number;
  _max: { hoursRun: Prisma.Decimal | null };
};

export function segmentMaxesFromGroupBy(rows: SegmentMaxGroup[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r._max.hoursRun == null) continue;
    m.set(r.meterSegment, Number(r._max.hoursRun));
  }
  return m;
}

export function prefixOffsetBySegment(segmentMax: Map<number, number>): Map<number, number> {
  const keys = [...segmentMax.keys()].sort((a, b) => a - b);
  const out = new Map<number, number>();
  let sum = 0;
  for (const k of keys) {
    out.set(k, sum);
    sum += segmentMax.get(k) ?? 0;
  }
  return out;
}

export function totalLifetimeFromSegmentMaxes(segmentMax: Map<number, number>): number {
  let t = 0;
  for (const v of segmentMax.values()) {
    t += v;
  }
  return t;
}

export function toLifetimeReadings<T extends { entryDate: Date; hoursRun: number; meterSegment: number }>(
  entriesSortedAsc: T[],
  fullSegmentMaxes: Map<number, number>,
): Array<{ entryDate: Date; hoursRun: number }> {
  const prefix = prefixOffsetBySegment(fullSegmentMaxes);
  return entriesSortedAsc.map((e) => ({
    entryDate: e.entryDate,
    hoursRun: (prefix.get(e.meterSegment) ?? 0) + e.hoursRun,
  }));
}

export function lastReadingLifetime<T extends { entryDate: Date; hoursRun: number; meterSegment: number }>(
  entriesSortedAsc: T[],
  fullSegmentMaxes: Map<number, number>,
): number | null {
  if (entriesSortedAsc.length === 0) return null;
  const last = entriesSortedAsc[entriesSortedAsc.length - 1]!;
  const prefix = prefixOffsetBySegment(fullSegmentMaxes);
  return (prefix.get(last.meterSegment) ?? 0) + last.hoursRun;
}
