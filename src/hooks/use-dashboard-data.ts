"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/api/client";
import { apiPath } from "@/lib/config/app-config";
import {
  DashboardAnalytics,
  EquipmentListItem,
  ForecastDriftItem,
  ForecastMetrics,
  NotificationItem,
  PermissionCatalogItem,
  WeeklyPlanItem,
  UserRole,
} from "@/types/api";

export type AlertItem = {
  id: string;
  level: "APPROACHING" | "ISSUE_REQUIRED" | "NEAR_DUE" | "OVERDUE";
  message: string;
  createdAt: string;
  equipmentNumber: string;
  equipmentName: string;
};

export type CheckSheetItem = {
  id: string;
  equipmentId: string;
  equipmentNumber: string;
  equipmentName: string;
  usageUnit: "HOURS" | "KM";
  checkCode: string;
  dueDate: string;
  dueHours: number;
  status: "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE";
  triggerType: "HOURS" | "CALENDAR";
};

type CreateEquipmentInput = {
  equipmentNumber: string;
  displayName: string;
  equipmentClass?: string;
  averageHoursPerDay: number;
  currentHours: number;
  usageUnit: "HOURS" | "KM";
  checkRules: Array<{
    code: string;
    intervalHours: number;
    approachingOffsetHours: number;
    issueOffsetHours: number;
    nearOffsetHours: number;
    intervalTimeValue?: number;
    intervalTimeUnit?: "MONTHS" | "YEARS";
  }>;
  previousCheckCode?: string;
  previousCheckDate?: string;
};

type CreateEntryInput = {
  equipmentId: string;
  entryDate: string;
  hoursRun: number;
};

type UserItem = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  permissions: Array<{ key: string; allowed: boolean }>;
};

type CreateUserInput = {
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
};

export function useAnalytics() {
  return useQuery({
    queryKey: ["dashboard", "analytics"],
    queryFn: () => apiGet<DashboardAnalytics>("/api/dashboard/analytics"),
  });
}

export function useEquipments() {
  return useQuery({
    queryKey: ["equipment", "list"],
    queryFn: () => apiGet<EquipmentListItem[]>("/api/equipment"),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiGet<AlertItem[]>("/api/alerts"),
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      apiPatch<{ id: string; acknowledged: boolean }>(
        `/api/alerts/${alertId}/acknowledge`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationItem[]>("/api/notifications"),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) =>
      apiPatch<{ id: string; status: "READ" }>(
        `/api/notifications/${notificationId}/read`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export function useCheckSheets() {
  return useQuery({
    queryKey: ["checksheets"],
    queryFn: () => apiGet<CheckSheetItem[]>("/api/checksheets"),
  });
}

export type CheckSheetManagementItem = {
  id: string;
  equipmentId: string;
  equipmentNumber: string;
  equipmentName: string;
  usageUnit: "HOURS" | "KM";
  checkCode: string;
  dueHours: number;
  dueDate: string;
  triggerType: string;
  status: string;
  issuedAt: string | null;
  completedAt: string | null;
  pdfFilePath: string | null;
  completedHours: number | null;
};

export function useAllCheckSheets() {
  return useQuery({
    queryKey: ["checksheets", "all"],
    queryFn: () => apiGet<CheckSheetManagementItem[]>("/api/checksheets/all"),
  });
}

export function useUploadCheckSheetPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { checkSheetId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      const response = await fetch(apiPath(`/api/checksheets/${payload.checkSheetId}/file`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to upload PDF");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checksheets", "all"] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail"] });
    },
  });
}

export function useDeleteCheckSheetPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkSheetId: string) =>
      apiDelete<{ success: boolean }>(`/api/checksheets/${checkSheetId}/file`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checksheets", "all"] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail"] });
    },
  });
}

export function useUploadCompletedCheckPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { checkSheetId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      const response = await fetch(apiPath(`/api/checksheets/${payload.checkSheetId}/completed-file`), {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to upload reference PDF");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
    },
  });
}

export function useDeleteCompletedCheckPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (checkSheetId: string) =>
      apiDelete<{ success: boolean }>(`/api/checksheets/${checkSheetId}/completed-file`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
    },
  });
}

export function useEquipmentPlan(equipmentId: string | null, year: number) {
  return useQuery({
    queryKey: ["equipment", "plan", equipmentId, year],
    queryFn: () =>
      apiGet<WeeklyPlanItem[]>(`/api/equipment/${equipmentId}/plan?year=${year}`),
    enabled: Boolean(equipmentId),
  });
}

export function useForecastMetrics(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", "forecast", equipmentId],
    queryFn: () =>
      apiGet<ForecastMetrics>(`/api/equipment/${equipmentId}/forecast`),
    enabled: Boolean(equipmentId),
  });
}

export function useForecastDrift() {
  return useQuery({
    queryKey: ["forecast", "drift"],
    queryFn: () => apiGet<ForecastDriftItem[]>("/api/forecast/drift"),
  });
}

type SystemConfig = {
  reminderHoursBefore: number;
  approachingOffsetHours: number;
  issueOffsetHours: number;
  nearOffsetHours: number;
};

export function useSystemConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => apiGet<SystemConfig>("/api/config"),
  });
}

export function useUpdateSystemConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      reminderHoursBefore?: number;
      approachingOffsetHours?: number;
      issueOffsetHours?: number;
      nearOffsetHours?: number;
    }) =>
      apiPatch<SystemConfig>("/api/config", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
  });
}

export function useRunEscalation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<{
        checksEscalated: number;
        alertsCreated: number;
        notificationsCreated: number;
      }>("/api/escalation/run", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export function useCreateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEquipmentInput) =>
      apiPost<{ id: string }>("/api/equipment", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export type PendingEntryItem = {
  id: string;
  equipmentId: string;
  equipmentNumber: string;
  equipmentName: string;
  usageUnit: "HOURS" | "KM";
  entryDate: string;
  hoursRun: number;
  status: string;
  createdBy: string;
  createdByEmail: string;
  createdAt: string;
  previousEntryDate: string | null;
  previousHours: number;
  currentEquipmentHours: number;
};

export function usePendingEntries() {
  return useQuery({
    queryKey: ["entries", "pending"],
    queryFn: () => apiGet<PendingEntryItem[]>("/api/entries/pending"),
  });
}

export type AllEntryItem = PendingEntryItem & {
  approvedBy: string | null;
  approvedByEmail: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedByEmail: string | null;
  rejectedAt: string | null;
  usageUnit: "HOURS" | "KM";
};

export function useAllEntries(filters?: {
  status?: string;
  equipmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.set("status", filters.status);
  if (filters?.equipmentId) queryParams.set("equipmentId", filters.equipmentId);
  if (filters?.dateFrom) queryParams.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) queryParams.set("dateTo", filters.dateTo);

  const queryString = queryParams.toString();
  return useQuery({
    queryKey: ["entries", "all", filters],
    queryFn: () => apiGet<AllEntryItem[]>(`/api/entries/all${queryString ? `?${queryString}` : ""}`),
  });
}

export function useApproveEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      apiPatch<{ id: string; status: string; averageHoursPerDay: number; currentHours: number }>(
        `/api/entries/${entryId}/approve`,
        {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export function useRejectEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entryId: string; reason?: string }) =>
      apiPatch<{ id: string; status: string }>(
        `/api/entries/${payload.entryId}/reject`,
        { reason: payload.reason }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { entryId: string; entryDate?: string; hoursRun?: number }) =>
      apiPatch<{ id: string; entryDate: string; hoursRun: number; status: string }>(
        `/api/entries/${payload.entryId}`,
        { entryDate: payload.entryDate, hoursRun: payload.hoursRun }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const response = await fetch(`/api/entries/${entryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to delete entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["entries", "pending"] });
    },
  });
}

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEntryInput) =>
      apiPost<{ id: string; equipmentId: string; entryDate: string; hoursRun: number; status: string }>(
        `/api/equipment/${payload.equipmentId}/entries`,
        {
          entryDate: payload.entryDate,
          hoursRun: payload.hoursRun,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "list"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
    },
  });
}

export function useUpdateCheckSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; action: "issue" | "complete"; date: string; completedHours?: number }) =>
      apiPatch<{ id: string; status: string }>(`/api/checksheets/${payload.id}`, {
        action: payload.action,
        date: payload.date,
        completedHours: payload.completedHours,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData<CheckSheetItem[] | undefined>(["checksheets"], (old) => {
        if (!old) return old;
        return old.map((sheet) =>
          sheet.id === data.id ? { ...sheet, status: data.status as CheckSheetItem["status"] } : sheet
        );
      });
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
    },
  });
}

export function useUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiGet<UserItem[]>("/api/users"),
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserInput) =>
      apiPost<{ id: string }>("/api/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUpdatePermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      userId: string;
      permissions: Array<{ key: string; name: string; description?: string; allowed: boolean }>;
    }) =>
      apiPatch<{ success: boolean }>(`/api/users/${payload.userId}/permissions`, {
        permissions: payload.permissions,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function usePermissionCatalog(enabled: boolean) {
  return useQuery({
    queryKey: ["permissions", "catalog"],
    queryFn: () => apiGet<PermissionCatalogItem[]>("/api/permissions"),
    enabled,
  });
}

export type EquipmentDetail = {
  id: string;
  equipmentNumber: string;
  displayName: string;
  equipmentClass: string;
  averageHoursPerDay: number;
  currentHours: number;
  commissionedAt: string | null;
  isActive: boolean;
  usageUnit: "HOURS" | "KM";
  checkRules: Array<{
    id: string;
    code: string;
    intervalHours: number;
    approachingOffsetHours: number;
    issueOffsetHours: number;
    nearOffsetHours: number;
    intervalTimeValue: number | null;
    intervalTimeUnit: "MONTHS" | "YEARS" | null;
    isActive: boolean;
  }>;
  checkSheets: Array<{
    id: string;
    checkCode: string;
    dueHours: number;
    dueDate: string;
    triggerType: string;
    status: string;
    issuedAt: string | null;
    completedAt: string | null;
    pdfFilePath: string | null;
  }>;
  groundingPeriods: Array<{
    id: string;
    fromDate: string;
    toDate: string | null;
    reason: string;
  }>;
};

export function useEquipmentDetail(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", "detail", equipmentId],
    queryFn: () => apiGet<EquipmentDetail>(`/api/equipment/${equipmentId}`),
    enabled: Boolean(equipmentId),
  });
}

export type GroundingPeriodItem = {
  id: string;
  fromDate: string;
  toDate: string | null;
  reason: string;
};

export function useGroundingPeriods(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", "groundings", equipmentId],
    queryFn: () => apiGet<GroundingPeriodItem[]>(`/api/equipment/${equipmentId}/groundings`),
    enabled: Boolean(equipmentId),
  });
}

export function useCreateGrounding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { equipmentId: string; fromDate: string; reason: string }) =>
      apiPost<GroundingPeriodItem>(`/api/equipment/${payload.equipmentId}/groundings`, {
        fromDate: payload.fromDate,
        reason: payload.reason,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "groundings", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export function useEndGrounding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { equipmentId: string; groundingId: string; toDate: string }) =>
      apiPatch<GroundingPeriodItem>(
        `/api/equipment/${payload.equipmentId}/groundings/${payload.groundingId}`,
        { toDate: payload.toDate },
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "groundings", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export type EquipmentHistory = {
  equipment: {
    id: string;
    equipmentNumber: string;
    displayName: string;
    equipmentClass: string;
    usageUnit: "HOURS" | "KM";
    averageHoursPerDay: number;
    currentHours: number;
    commissionedAt: string | null;
    createdAt: string;
  };
  entries: Array<{
    id: string;
    entryDate: string;
    hoursRun: number;
    createdBy: string | null;
    createdByEmail: string | null;
    approvedBy: string | null;
    approvedByEmail: string | null;
    approvedAt: string | null;
  }>;
  checks: Array<{
    id: string;
    checkCode: string;
    dueHours: number;
    dueDate: string;
    triggerType: string;
    status: string;
    issuedAt: string | null;
    completedAt: string | null;
    completedHours: number | null;
    pdfFilePath: string | null;
    isMissed: boolean;
  }>;
  groundingPeriods: GroundingPeriodItem[];
};

export function useEquipmentHistory(
  equipmentId: string | null,
  filters?: { from?: string; to?: string },
) {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const qs = params.toString();
  return useQuery({
    queryKey: ["equipment", "history", equipmentId, filters],
    queryFn: () =>
      apiGet<EquipmentHistory>(
        `/api/equipment/${equipmentId}/history${qs ? `?${qs}` : ""}`,
      ),
    enabled: Boolean(equipmentId),
  });
}

export function useUpdateEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      equipmentId: string;
      equipmentNumber?: string;
      displayName?: string;
      equipmentClass?: string;
      averageHoursPerDay?: number;
      currentHours?: number;
      commissionedAt?: string | null;
      isActive?: boolean;
      usageUnit?: "HOURS" | "KM";
    }) =>
      apiPatch<{ id: string; equipmentNumber: string; displayName: string }>(
        `/api/equipment/${payload.equipmentId}`,
        {
          equipmentNumber: payload.equipmentNumber,
          displayName: payload.displayName,
          equipmentClass: payload.equipmentClass,
          averageHoursPerDay: payload.averageHoursPerDay,
          currentHours: payload.currentHours,
          commissionedAt: payload.commissionedAt,
          isActive: payload.isActive,
          usageUnit: payload.usageUnit,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export function useDeleteEquipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (equipmentId: string) =>
      apiDelete<{ id: string }>(`/api/equipment/${equipmentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "analytics"] });
    },
  });
}

export type CheckRuleItem = {
  id: string;
  code: string;
  intervalHours: number;
  intervalTimeValue?: number | null;
  intervalTimeUnit?: "MONTHS" | "YEARS" | null;
  approachingOffsetHours: number;
  issueOffsetHours: number;
  nearOffsetHours: number;
  isActive: boolean;
  templatePdfPath?: string | null;
};

export function useCheckRules(equipmentId: string | null) {
  return useQuery({
    queryKey: ["equipment", "checkRules", equipmentId],
    queryFn: () => apiGet<CheckRuleItem[]>(`/api/equipment/${equipmentId}/check-rules`),
    enabled: Boolean(equipmentId),
  });
}

export function useCreateCheckRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      equipmentId: string;
      code: string;
      intervalHours: number;
      intervalTimeValue?: number;
      intervalTimeUnit?: "MONTHS" | "YEARS";
    }) =>
      apiPost<CheckRuleItem>(`/api/equipment/${payload.equipmentId}/check-rules`, {
        code: payload.code,
        intervalHours: payload.intervalHours,
        intervalTimeValue: payload.intervalTimeValue,
        intervalTimeUnit: payload.intervalTimeUnit,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "checkRules", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export function useUpdateCheckRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      equipmentId: string;
      ruleId: string;
      intervalHours?: number;
      isActive?: boolean;
      intervalTimeValue?: number | null;
      intervalTimeUnit?: "MONTHS" | "YEARS" | null;
    }) =>
      apiPatch<CheckRuleItem>(
        `/api/equipment/${payload.equipmentId}/check-rules/${payload.ruleId}`,
        {
          intervalHours: payload.intervalHours,
          isActive: payload.isActive,
          intervalTimeValue: payload.intervalTimeValue,
          intervalTimeUnit: payload.intervalTimeUnit,
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "checkRules", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export function useDeleteCheckRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { equipmentId: string; ruleId: string }) =>
      apiDelete<{ id: string }>(`/api/equipment/${payload.equipmentId}/check-rules/${payload.ruleId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "checkRules", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export function useUploadCheckRuleTemplatePdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { equipmentId: string; ruleId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", payload.file);
      const response = await fetch(
        `/api/equipment/${payload.equipmentId}/check-rules/${payload.ruleId}/template-file`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Failed to upload template PDF");
      }
      return result.data as { filePath: string };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "checkRules", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export function useDeleteCheckRuleTemplatePdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { equipmentId: string; ruleId: string }) =>
      apiDelete<{ success: boolean }>(
        `/api/equipment/${payload.equipmentId}/check-rules/${payload.ruleId}/template-file`
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "checkRules", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
    },
  });
}

export type CheckSheetDetailItem = {
  id: string;
  checkCode: string;
  dueHours: number;
  dueDate: string;
  triggerType: string;
  status: string;
  issuedAt: string | null;
  completedAt: string | null;
  pdfFilePath: string | null;
};

export function useUpdateCheckSheetDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      equipmentId: string;
      sheetId: string;
      checkCode?: string;
      dueHours?: number;
      dueDate?: string;
      triggerType?: "HOURS" | "CALENDAR";
      status?: "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE";
      issuedAt?: string | null;
      completedAt?: string | null;
    }) =>
      apiPatch<CheckSheetDetailItem>(
        `/api/equipment/${payload.equipmentId}/check-sheets/${payload.sheetId}`,
        {
          checkCode: payload.checkCode,
          dueHours: payload.dueHours,
          dueDate: payload.dueDate,
          triggerType: payload.triggerType,
          status: payload.status,
          issuedAt: payload.issuedAt,
          completedAt: payload.completedAt,
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
    },
  });
}

export function useDeleteCheckSheetDetail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { equipmentId: string; sheetId: string }) =>
      apiDelete<{ id: string }>(`/api/equipment/${payload.equipmentId}/check-sheets/${payload.sheetId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["equipment", "detail", variables.equipmentId] });
      queryClient.invalidateQueries({ queryKey: ["checksheets"] });
    },
  });
}
