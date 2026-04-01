import { prisma } from "@/lib/prisma";

const CONFIG_CACHE_TTL = 60000;
const HOURS_TO_DAYS_BASE = 8;

let systemConfigCache: {
  approachingOffsetDays: number;
  issueOffsetDays: number;
  nearOffsetDays: number;
  timestamp: number;
} | null = null;

export async function getSystemThresholds() {
  const now = Date.now();
  if (systemConfigCache && (now - systemConfigCache.timestamp) < CONFIG_CACHE_TTL) {
    return {
      approachingOffsetDays: systemConfigCache.approachingOffsetDays,
      issueOffsetDays: systemConfigCache.issueOffsetDays,
      nearOffsetDays: systemConfigCache.nearOffsetDays,
    };
  }

  const [approachingDaysConfig, issueDaysConfig, nearDaysConfig, approachingConfig, issueConfig, nearConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "approaching_offset_days" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "issue_offset_days" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "near_offset_days" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "approaching_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "issue_offset_hours" } }).catch(() => null),
    prisma.systemConfig.findUnique({ where: { key: "near_offset_hours" } }).catch(() => null),
  ]);

  const approachingOffsetDays = approachingDaysConfig
    ? Number(approachingDaysConfig.value)
    : (approachingConfig ? Number(approachingConfig.value) : 120) / HOURS_TO_DAYS_BASE;
  const issueOffsetDays = issueDaysConfig
    ? Number(issueDaysConfig.value)
    : (issueConfig ? Number(issueConfig.value) : 40) / HOURS_TO_DAYS_BASE;
  const nearOffsetDays = nearDaysConfig
    ? Number(nearDaysConfig.value)
    : (nearConfig ? Number(nearConfig.value) : 10) / HOURS_TO_DAYS_BASE;

  const thresholds = {
    approachingOffsetDays: Math.max(0, approachingOffsetDays),
    issueOffsetDays: Math.max(0, issueOffsetDays),
    nearOffsetDays: Math.max(0, nearOffsetDays),
  };

  systemConfigCache = {
    ...thresholds,
    timestamp: now,
  };

  return thresholds;
}
