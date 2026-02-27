export type SystemStatus = {
  service: string;
  app: "online" | "degraded";
  database: "connected" | "disconnected";
  timestamp: string;
};

export type ApiSuccess<T> = {
  data: T;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";

export type DashboardAnalytics = {
  equipmentCount: number;
  activeAlerts: number;
  todayEntries: number;
  checksDueSoon: number;
  unreadNotifications: number;
  overdueEscalations: number;
};

export type EquipmentListItem = {
  id: string;
  equipmentNumber: string;
  displayName: string;
  equipmentClass: string;
  averageHoursPerDay: number;
  currentHours: number;
  usageUnit: "HOURS" | "KM";
  activeRuleCount: number;
  hasActiveGrounding?: boolean;
};

export type CheckRuleInput = {
  code: string;
  intervalHours: number;
  approachingOffsetHours: number;
  issueOffsetHours: number;
  nearOffsetHours: number;
};

export type WeeklyPlanItem = {
  week: number;
  checkCode: string;
  triggerType: "HOURS" | "CALENDAR";
  dueDate: string;
  dueHours: number;
  status: "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE";
};

export type ForecastMetrics = {
  forecastAverageHoursPerDay: number;
  confidenceLowHoursPerDay: number;
  confidenceHighHoursPerDay: number;
  meanAbsoluteError: number;
  meanAbsolutePercentageError: number;
  sampleSize: number;
};

export type PermissionCatalogItem = {
  key: string;
  name: string;
};

export type NotificationItem = {
  id: string;
  channel: "IN_APP" | "EMAIL" | "SMS";
  status: "PENDING" | "SENT" | "FAILED" | "READ";
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  isUnread: boolean;
};

export type ForecastDriftItem = {
  equipmentClass: string;
  equipmentCount: number;
  averageMape: number;
  driftPercent: number;
  riskLevel: "low" | "medium" | "high";
};
