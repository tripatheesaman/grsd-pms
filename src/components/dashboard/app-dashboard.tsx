"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useLogout } from "@/hooks/use-auth";
import {
  useAcknowledgeAlert,
  useAlerts,
  useAnalytics,
  useApproveEntry,
  useApproveEntriesByDate,
  useCheckSheets,
  useCreateEntry,
  useCreateEquipment,
  useCreateGrounding,
  useCreateUser,
  useDeleteEntry,
  useForecastDrift,
  useForecastMetrics,
  useEquipmentPlan,
  useEquipments,
  useGroundingPeriods,
  useMarkNotificationRead,
  useNotifications,
  usePendingEntries,
  useAllEntries,
  type AllEntryItem,
  usePermissionCatalog,
  useRejectEntry,
  useRunEscalation,
  useSystemConfig,
  useUpdateCheckSheet,
  useUpdateEntry,
  useUpdatePermissions,
  useUpdateSystemConfig,
  useUsers,
  useEquipmentDetail,
  useUpdateEquipment,
  useDeleteEquipment,
  useCheckRules,
  useCreateCheckRule,
  useUpdateCheckRule,
  useDeleteCheckRule,
  useUpdateCheckSheetDetail,
  useDeleteCheckSheetDetail,
  useAllCheckSheets,
  useUploadCheckSheetPdf,
  useDeleteCheckSheetPdf,
  useUploadCheckRuleTemplatePdf,
  useDeleteCheckRuleTemplatePdf,
  useUploadCompletedCheckPdf,
  useDeleteCompletedCheckPdf,
  useEndGrounding,
  useEquipmentHistory,
} from "@/hooks/use-dashboard-data";
import { UserRole } from "@/types/api";
import { formatDate } from "@/lib/utils/date";
import { PendingEntryItem } from "@/hooks/use-dashboard-data";
import type { CheckSheetItem, CheckSheetManagementItem } from "@/hooks/use-dashboard-data";
import { BASE_PATH, UPLOADS_BASE_URL, apiPath } from "@/lib/config/app-config";

type DashboardUser = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

type PendingEntryCardProps = {
  entry: PendingEntryItem;
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onUpdate: (id: string, entryDate: string, hoursRun: number) => void;
  onDelete: (id: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
};

function PendingEntryCard({ entry, onApprove, onReject, onUpdate, onDelete, isApproving, isRejecting, isUpdating, isDeleting }: PendingEntryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(entry.entryDate.slice(0, 10));
  const [editHours, setEditHours] = useState(String(entry.hoursRun));
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const unitLabel = entry.usageUnit === "KM" ? "Kilometers" : "Hours";
  const hoursError = Number(editHours) < entry.previousHours
    ? `${unitLabel} must be at least ${entry.previousHours.toFixed(2)} (previous entry value)`
    : undefined;

  return (
    <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <p className="text-base font-bold text-[var(--color-text)]">{entry.equipmentNumber}</p>
            <span className="px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold">PENDING</span>
          </div>
          <p className="text-sm font-medium text-[var(--color-text-soft)] mb-1">Created by: {entry.createdBy} ({entry.createdByEmail})</p>
          <p className="text-xs text-[var(--color-text-soft)]">Created: {formatDate(entry.createdAt)}</p>
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Entry Date</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{formatDate(entry.entryDate)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">{unitLabel === "Kilometers" ? "Kilometers" : "Hours Run"}</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{entry.hoursRun.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 border-t-2 border-[var(--color-surface-strong)]">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Previous Entry Date</p>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {entry.previousEntryDate ? formatDate(entry.previousEntryDate) : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Previous {unitLabel}</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{entry.previousHours.toFixed(2)}</p>
            </div>
          </div>
          <div className="pt-3 border-t-2 border-[var(--color-surface-strong)]">
            <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Current Equipment {unitLabel}</p>
            <p className="text-sm font-medium text-[var(--color-text)]">{entry.currentEquipmentHours.toFixed(2)}</p>
          </div>
          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 rounded-lg border-2 border-[var(--color-primary)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="flex-1 rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-400 hover:text-white"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onApprove(entry.id)}
              disabled={isApproving || Number(entry.hoursRun) < entry.previousHours}
              className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isApproving ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={isDeleting}
              className="rounded-lg border-2 border-red-400 bg-white px-4 py-2 text-sm font-bold text-red-600 transition-all hover:bg-red-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete
            </button>
          </div>
          {Number(entry.hoursRun) < entry.previousHours && (
            <p className="text-xs font-medium text-red-600 mt-2">
              ⚠️ {unitLabel} must be at least {entry.previousHours.toFixed(2)} (previous entry value)
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Entry Date</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">{unitLabel === "Kilometers" ? "Kilometers" : "Hours Run"}</label>
              <input
                type="number"
                min={entry.previousHours}
                step={0.1}
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                className={`h-10 w-full rounded-lg border-2 ${hoursError ? "border-red-400" : "border-[var(--color-surface-strong)]"} bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20`}
              />
              {hoursError && (
                <p className="mt-1 text-xs font-medium text-red-600">{hoursError}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onUpdate(entry.id, new Date(`${editDate}T00:00:00.000Z`).toISOString(), Number(editHours));
                setIsEditing(false);
              }}
              disabled={isUpdating || !!hoursError || !editDate || !editHours}
              className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setEditDate(entry.entryDate.slice(0, 10));
                setEditHours(String(entry.hoursRun));
              }}
              className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowRejectModal(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Reject Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Reason (Optional)</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="h-24 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  placeholder="Enter rejection reason..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onReject(entry.id, rejectReason);
                    setShowRejectModal(false);
                    setRejectReason("");
                  }}
                  disabled={isRejecting}
                  className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRejecting ? "Rejecting..." : "Reject"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
                  }}
                  className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Delete Entry</h3>
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--color-text-soft)]">
                Are you sure you want to delete this entry? This action cannot be undone.
              </p>
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-yellow-800 mb-1">Entry Details:</p>
                <p className="text-xs text-yellow-700">Equipment: {entry.equipmentNumber}</p>
                <p className="text-xs text-yellow-700">Date: {formatDate(entry.entryDate)}</p>
                <p className="text-xs text-yellow-700">Hours: {entry.hoursRun.toFixed(2)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onDelete(entry.id);
                    setShowDeleteModal(false);
                  }}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type WeeklyPlanItem = {
  week: number;
  checkCode: string;
  triggerType: "HOURS" | "CALENDAR";
  dueDate: string;
  dueHours: number;
  status: "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE";
};

type CalendarProps = {
  planData: WeeklyPlanItem[];
};

type MonthlyCalendarProps = CalendarProps & {
  year: number;
  month: number;
  onMonthChange: (month: number) => void;
  onYearChange?: (year: number) => void;
  onDateClick: (date: Date) => void;
};

type WeeklyCalendarProps = CalendarProps & {
  weekStart: Date;
  onWeekChange: (date: Date) => void;
  onDateClick: (date: Date) => void;
};

type DailyCalendarProps = CalendarProps & {
  date: Date;
  onDateChange: (date: Date) => void;
};

type YearlyCalendarProps = CalendarProps & {
  year: number;
  onYearChange: (year: number) => void;
  onWeekClick: (week: number, date: Date) => void;
};

function getCheckTypeAccent(code: string) {
  switch (code.toUpperCase()) {
    case "A":
      return "ring-2 ring-purple-500";
    case "B":
      return "ring-2 ring-indigo-500";
    case "C":
      return "ring-2 ring-pink-500";
    case "D":
      return "ring-2 ring-emerald-500";
    case "E":
      return "ring-2 ring-orange-500";
    case "F":
      return "ring-2 ring-teal-500";
    case "G":
      return "ring-2 ring-cyan-500";
    case "H":
      return "ring-2 ring-fuchsia-500";
    default:
      return "ring-2 ring-slate-400";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "OVERDUE":
      return "bg-red-900 text-white";
    case "NEAR_DUE":
      return "bg-red-600 text-white";
    case "ISSUE_REQUIRED":
      return "bg-yellow-500 text-yellow-900";
    case "ISSUED":
      return "bg-yellow-400 text-yellow-900";
    case "COMPLETED":
      return "bg-green-500 text-white";
    case "PREDICTED":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

function MonthlyCalendar({ year, month, onMonthChange, onYearChange, planData, onDateClick }: MonthlyCalendarProps) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    days.push(date);
  }

  const monthName = firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getChecksForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return planData.filter((item) => {
      const itemDate = new Date(item.dueDate);
      return itemDate.toISOString().split("T")[0] === dateStr;
    });
  };

  const navigateMonth = (direction: number) => {
    const newDate = new Date(year, month + direction, 1);
    onMonthChange(newDate.getMonth());
    if (onYearChange && newDate.getFullYear() !== year) {
      onYearChange(newDate.getFullYear());
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          ← Prev
        </button>
        <h3 className="text-lg font-bold text-[var(--color-text)]">{monthName}</h3>
        <button
          type="button"
          onClick={() => navigateMonth(1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          Next →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="p-2 text-center text-xs font-bold text-[var(--color-text-soft)]">
            {day}
          </div>
        ))}
        {days.map((date, idx) => {
          const isCurrentMonth = date.getMonth() === month;
          const isToday = date.toDateString() === new Date().toDateString();
          const checks = getChecksForDate(date);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDateClick(date)}
              className={`min-h-[80px] rounded-lg border-2 p-2 text-left transition-all hover:scale-[1.02] ${
                isCurrentMonth
                  ? isToday
                    ? "border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)]/20 to-white shadow-md"
                    : "border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)]"
                  : "border-[var(--color-surface-strong)] bg-[var(--color-surface)] opacity-50"
              }`}
            >
              <p className={`text-xs font-bold ${isCurrentMonth ? "text-[var(--color-text)]" : "text-[var(--color-text-soft)]"}`}>
                {date.getDate()}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {checks.map((check, checkIdx) => (
                  <span
                    key={checkIdx}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getStatusColor(check.status)} ${getCheckTypeAccent(check.checkCode)}`}
                    title={`${check.checkCode} - ${check.status} (${formatDate(check.dueDate)})`}
                  >
                    {check.checkCode}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyCalendar({ weekStart, onWeekChange, planData, onDateClick }: WeeklyCalendarProps) {
  const startOfWeek = new Date(weekStart);
  startOfWeek.setDate(weekStart.getDate() - weekStart.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    days.push(date);
  }

  const weekRange = `${formatDate(days[0])} - ${formatDate(days[6])}`;

  const getChecksForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return planData.filter((item) => {
      const itemDate = new Date(item.dueDate);
      return itemDate.toISOString().split("T")[0] === dateStr;
    });
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + direction * 7);
    onWeekChange(newDate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateWeek(-1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          ← Prev Week
        </button>
        <h3 className="text-lg font-bold text-[var(--color-text)]">{weekRange}</h3>
        <button
          type="button"
          onClick={() => navigateWeek(1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          Next Week →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-3">
        {days.map((date, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const checks = getChecksForDate(date);
          const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDateClick(date)}
              className={`min-h-[120px] rounded-xl border-2 p-3 text-left transition-all hover:scale-[1.02] ${
                isToday
                  ? "border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)]/20 to-white shadow-md"
                  : "border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)]"
              }`}
            >
              <p className="text-xs font-bold text-[var(--color-text-soft)]">{dayName}</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{date.getDate()}</p>
              <div className="mt-2 space-y-1">
                {checks.map((check, checkIdx) => (
                  <div
                    key={checkIdx}
                    className={`rounded px-2 py-1 text-xs font-bold ${getStatusColor(check.status)} ${getCheckTypeAccent(check.checkCode)}`}
                    title={`${check.checkCode} - ${check.status} (${formatDate(check.dueDate)})`}
                  >
                    {check.checkCode}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DailyCalendar({ date, onDateChange, planData }: DailyCalendarProps) {
  const checks = planData.filter((item) => {
    const itemDate = new Date(item.dueDate);
    return itemDate.toISOString().split("T")[0] === date.toISOString().split("T")[0];
  });

  const navigateDay = (direction: number) => {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + direction);
    onDateChange(newDate);
  };

  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateDay(-1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          ← Prev Day
        </button>
        <h3 className="text-lg font-bold text-[var(--color-text)]">
          {date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </h3>
        <button
          type="button"
          onClick={() => navigateDay(1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          Next Day →
        </button>
      </div>
      <div className={`rounded-xl border-2 p-6 ${isToday ? "border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)]/10 to-white" : "border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)]"}`}>
        {checks.length > 0 ? (
          <div className="space-y-3">
            {checks.map((check, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-2 p-4 ${getStatusColor(check.status)} ${getCheckTypeAccent(check.checkCode)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">Check {check.checkCode}</p>
                    <p className="text-xs opacity-90 mt-1">
                      Status: {check.status.replace("_", " ")} | Trigger: {check.triggerType}
                    </p>
                    <p className="text-xs opacity-90">Due: {check.dueHours.toFixed(0)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-[var(--color-text-soft)]">No maintenance checks scheduled for this day</p>
          </div>
        )}
      </div>
    </div>
  );
}

function isoWeek(date: Date) {
  const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  return Math.ceil((((value.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getWeekStartDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  return weekStart;
}

function YearlyCalendar({ year, onYearChange, planData, onWeekClick }: YearlyCalendarProps) {
  const totalWeeks = 53;
  const currentWeek = isoWeek(new Date());
  const currentYear = new Date().getFullYear();

  const weeksByNumber = useMemo(() => {
    const weeks: Array<{ week: number; checks: WeeklyPlanItem[]; startDate: Date }> = [];
    for (let week = 1; week <= totalWeeks; week++) {
      const startDate = getWeekStartDate(year, week);
      if (startDate.getFullYear() !== year && week > 1) {
        break;
      }
      const weekChecks = planData.filter((item) => item.week === week);
      weeks.push({ week, checks: weekChecks, startDate });
    }
    return weeks;
  }, [year, planData, totalWeeks]);

  const navigateYear = (direction: number) => {
    onYearChange(year + direction);
  };

  const getWeekStatus = (checks: WeeklyPlanItem[]): string | null => {
    if (checks.some((c) => c.status === "OVERDUE")) return "OVERDUE";
    if (checks.some((c) => c.status === "NEAR_DUE")) return "NEAR_DUE";
    if (checks.some((c) => c.status === "ISSUE_REQUIRED")) return "ISSUE_REQUIRED";
    if (checks.some((c) => c.status === "ISSUED")) return "ISSUED";
    if (checks.some((c) => c.status === "COMPLETED")) return "COMPLETED";
    if (checks.some((c) => c.status === "PREDICTED")) return "PREDICTED";
    return null;
  };

  const getWeekTileClasses = (status: string | null, isCurrent: boolean, hasChecks: boolean) => {
    if (isCurrent) {
      return "border-[var(--color-primary)] bg-gradient-to-br from-[var(--color-primary)]/20 to-white shadow-md";
    }
    if (!hasChecks || !status) {
      return "border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)]";
    }
    switch (status) {
      case "OVERDUE":
        return "border-red-900 bg-gradient-to-br from-red-900/10 to-red-700/10";
      case "NEAR_DUE":
        return "border-red-600 bg-gradient-to-br from-red-600/10 to-red-400/10";
      case "ISSUE_REQUIRED":
        return "border-yellow-500 bg-gradient-to-br from-yellow-200/40 to-yellow-100/40";
      case "ISSUED":
        return "border-yellow-500 bg-gradient-to-br from-yellow-100/40 to-yellow-50/40";
      case "COMPLETED":
        return "border-green-500 bg-gradient-to-br from-green-200/40 to-green-100/40";
      case "PREDICTED":
        return "border-blue-500 bg-gradient-to-br from-blue-200/40 to-blue-100/40";
      default:
        return "border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)]";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateYear(-1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          ← Prev Year
        </button>
        <h3 className="text-lg font-bold text-[var(--color-text)]">{year}</h3>
        <button
          type="button"
          onClick={() => navigateYear(1)}
          className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
        >
          Next Year →
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {weeksByNumber.map((weekData) => {
          const isCurrentWeek = year === currentYear && weekData.week === currentWeek;
          const hasChecks = weekData.checks.length > 0;
          const weekStatus = getWeekStatus(weekData.checks);
          const tileClasses = getWeekTileClasses(weekStatus, isCurrentWeek, hasChecks);
          return (
            <button
              key={weekData.week}
              type="button"
              onClick={() => onWeekClick(weekData.week, weekData.startDate)}
              className={`min-h-[100px] rounded-xl border-2 p-3 text-center transition-all hover:scale-[1.02] ${tileClasses}`}
            >
              <p className="text-xs font-bold text-[var(--color-text-soft)] mb-2">Week {weekData.week}</p>
              <p className="text-[10px] font-medium text-[var(--color-text-soft)] mb-2">
                {formatDate(weekData.startDate)}
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {weekData.checks.map((check, idx) => (
                  <span
                    key={idx}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getStatusColor(check.status)} ${getCheckTypeAccent(check.checkCode)}`}
                    title={`${check.checkCode} - ${check.status} (${formatDate(check.dueDate)})`}
                  >
                    {check.checkCode}
                  </span>
                ))}
                {!hasChecks && (
                  <span className="text-[10px] font-medium text-[var(--color-text-soft)]">-</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const sections = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "entries", label: "Entries", icon: "📝" },
  { key: "pending-approvals", label: "Pending Approvals", icon: "⏳" },
  { key: "entries-report", label: "Entries Report", icon: "📊" },
  { key: "planning", label: "Planning", icon: "📅" },
  { key: "checks", label: "Upcoming Checks", icon: "✅" },
  { key: "ongoing-checks", label: "Ongoing Checks", icon: "⏱️" },
  { key: "completed-checks", label: "Completed Checks", icon: "✔️" },
  { key: "all-checks", label: "All Checks", icon: "📋" },
  { key: "equipment-history", label: "Equipment History", icon: "📚" },
  { key: "equipment-management", label: "Equipment Management", icon: "🔧" },
  { key: "admin", label: "Admin", icon: "⚙️" },
] as const;

export function AppDashboard({ user }: { user: DashboardUser }) {
  const logout = useLogout();
  const analytics = useAnalytics();
  const equipments = useEquipments();
  const alerts = useAlerts();
  const acknowledgeAlert = useAcknowledgeAlert();
  const checksheets = useCheckSheets();
  const notifications = useNotifications();
  const markNotificationRead = useMarkNotificationRead();
  const forecastDrift = useForecastDrift();
  const runEscalation = useRunEscalation();
  const canAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const isSuperadmin = user.role === "SUPERADMIN";
  const users = useUsers(isSuperadmin);
  const permissionCatalog = usePermissionCatalog(isSuperadmin);
  const createUser = useCreateUser();
  const updatePermissions = useUpdatePermissions();
  const createEquipment = useCreateEquipment();
  const createEntry = useCreateEntry();
  const updateCheckSheet = useUpdateCheckSheet();
  const systemConfig = useSystemConfig();
  const updateSystemConfig = useUpdateSystemConfig();
  const pendingEntries = usePendingEntries();
  const approveEntry = useApproveEntry();
  const approveEntriesByDate = useApproveEntriesByDate();
  const rejectEntry = useRejectEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  useEffect(() => {
    if (systemConfig.data) {
      setReminderHours(String(systemConfig.data.reminderHoursBefore));
      setApproachingHours(String(systemConfig.data.approachingOffsetHours));
      setIssueHours(String(systemConfig.data.issueOffsetHours));
      setNearHours(String(systemConfig.data.nearOffsetHours));
    }
  }, [systemConfig.data]);

  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["key"]>("overview");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryHours, setEntryHours] = useState("0");
  const [year, setYear] = useState(new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<"monthly" | "weekly" | "daily" | "yearly">("monthly");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [currentDay, setCurrentDay] = useState(new Date());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [equipmentSearchOpen, setEquipmentSearchOpen] = useState(false);
  const [equipmentSearchIndex, setEquipmentSearchIndex] = useState(-1);
  const [equipmentError, setEquipmentError] = useState<string | undefined>(undefined);
  const [hoursError, setHoursError] = useState<string | undefined>(undefined);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<Array<{ equipmentId: string; hours: string; previous: number; error?: string }>>([]);
  const equipmentSearchRef = useRef<HTMLDivElement>(null);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years: number[] = [];
    for (let value = current - 3; value <= current + 3; value += 1) {
      years.push(value);
    }
    return years;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (equipmentSearchRef.current && !equipmentSearchRef.current.contains(event.target as Node)) {
        setEquipmentSearchOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    if (equipmentSearchOpen || profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [equipmentSearchOpen, profileMenuOpen]);

  const [equipmentNumber, setEquipmentNumber] = useState("");
  const [equipmentDisplayName, setEquipmentDisplayName] = useState("");
  const [avgHours, setAvgHours] = useState("8");
  const [currentHours, setCurrentHours] = useState("0");
  const [previousCheckCode, setPreviousCheckCode] = useState("");
  const [previousCheckDate, setPreviousCheckDate] = useState("");
  const [checkRules, setCheckRules] = useState<Array<{ code: string; intervalHours: string }>>([
    { code: "A", intervalHours: "500" },
  ]);

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("USER");
  const [permissionUserId, setPermissionUserId] = useState("");
  const [permissionMap, setPermissionMap] = useState<Record<string, boolean>>({});
  const [alertFilter, setAlertFilter] = useState<"ALL" | "APPROACHING" | "ISSUE_REQUIRED" | "NEAR_DUE" | "OVERDUE">("ALL");
  const [checkFilter, setCheckFilter] = useState<"ALL" | "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "OVERDUE">("ALL");
  const [selectedEquipmentModal, setSelectedEquipmentModal] = useState<string | null>(null);
  const [issueModalCheck, setIssueModalCheck] = useState<CheckSheetItem | null>(null);
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [completeModalCheck, setCompleteModalCheck] = useState<CheckSheetItem | null>(null);
  const [completeDate, setCompleteDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [completeHours, setCompleteHours] = useState<string>("");
  const [selectedAlertModal, setSelectedAlertModal] = useState<string | null>(null);
  const [reminderHours, setReminderHours] = useState("120");
  const [checkDateFrom, setCheckDateFrom] = useState("");
  const [checkDateTo, setCheckDateTo] = useState("");
  const [checkEquipmentSearch, setCheckEquipmentSearch] = useState("");
  const [checkCodeFilter, setCheckCodeFilter] = useState("");
  const [checkTriggerTypeFilter, setCheckTriggerTypeFilter] = useState<"ALL" | "HOURS" | "CALENDAR">("ALL");
  const [approachingHours, setApproachingHours] = useState("120");
  const [issueHours, setIssueHours] = useState("40");
  const [nearHours, setNearHours] = useState("10");
  const [equipmentMgmtSearch, setEquipmentMgmtSearch] = useState("");
  const [equipmentMgmtClassFilter, setEquipmentMgmtClassFilter] = useState("ALL");
  const [equipmentMgmtStatusFilter, setEquipmentMgmtStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [equipmentMgmtSortBy, setEquipmentMgmtSortBy] = useState<"number" | "name" | "hours" | "avgHours">("number");
  const [equipmentMgmtSortOrder, setEquipmentMgmtSortOrder] = useState<"asc" | "desc">("asc");
  const [checkSheetMgmtTab, setCheckSheetMgmtTab] = useState<"equipment" | "checksheets">("equipment");
  const [checkSheetMgmtSearch, setCheckSheetMgmtSearch] = useState("");
  const [checkSheetMgmtStatusFilter, setCheckSheetMgmtStatusFilter] = useState<"ALL" | "PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE">("ALL");
  const [checkSheetMgmtEquipmentFilter, setCheckSheetMgmtEquipmentFilter] = useState("ALL");
  const [checkSheetMgmtCodeFilter, setCheckSheetMgmtCodeFilter] = useState("ALL");
  const [checkSheetMgmtDateFrom, setCheckSheetMgmtDateFrom] = useState("");
  const [checkSheetMgmtDateTo, setCheckSheetMgmtDateTo] = useState("");
  const [selectedEquipmentForMgmt, setSelectedEquipmentForMgmt] = useState<string | null>(null);
  const [showEquipmentEditModal, setShowEquipmentEditModal] = useState(false);
  const [showEquipmentCreateModal, setShowEquipmentCreateModal] = useState(false);
  const [showCheckRuleModal, setShowCheckRuleModal] = useState(false);
  const [showCheckSheetModal, setShowCheckSheetModal] = useState(false);
  const [showEquipmentDetailsModal, setShowEquipmentDetailsModal] = useState(false);
  const [editingCheckRuleId, setEditingCheckRuleId] = useState<string | null>(null);
  const [editingCheckSheetId, setEditingCheckSheetId] = useState<string | null>(null);
  const [editEquipmentNumber, setEditEquipmentNumber] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editEquipmentClass, setEditEquipmentClass] = useState("GENERAL");
  const [editAvgHours, setEditAvgHours] = useState("0");
  const [editCurrentHours, setEditCurrentHours] = useState("0");
  const [editCommissionedAt, setEditCommissionedAt] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editUsageUnit, setEditUsageUnit] = useState<"HOURS" | "KM">("HOURS");
  const [createUsageUnit, setCreateUsageUnit] = useState<"HOURS" | "KM">("HOURS");
  const [checkRuleCode, setCheckRuleCode] = useState("A");
  const [checkRuleIntervalHours, setCheckRuleIntervalHours] = useState("500");
  const [checkRuleIntervalTimeValue, setCheckRuleIntervalTimeValue] = useState("");
  const [checkRuleIntervalTimeUnit, setCheckRuleIntervalTimeUnit] = useState<"MONTHS" | "YEARS">("MONTHS");
  const [checkRuleIsActive, setCheckRuleIsActive] = useState(true);
  const [checkSheetCode, setCheckSheetCode] = useState("A");
  const [checkSheetDueHours, setCheckSheetDueHours] = useState("0");
  const [checkSheetDueDate, setCheckSheetDueDate] = useState("");
  const [checkSheetTriggerType, setCheckSheetTriggerType] = useState<"HOURS" | "CALENDAR">("HOURS");
  const [checkSheetStatus, setCheckSheetStatus] = useState<"PREDICTED" | "ISSUE_REQUIRED" | "NEAR_DUE" | "ISSUED" | "COMPLETED" | "OVERDUE">("PREDICTED");
  const [checkSheetIssuedAt, setCheckSheetIssuedAt] = useState("");
  const [checkSheetCompletedAt, setCheckSheetCompletedAt] = useState("");
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ type: "equipment" | "checkRule" | "checkSheet" | "entry"; id: string; name: string; onConfirm: () => void } | null>(null);

  const equipmentDetail = useEquipmentDetail(selectedEquipmentForMgmt);
  const groundingPeriods = useGroundingPeriods(selectedEquipmentForMgmt);
  const createGrounding = useCreateGrounding();
  const endGrounding = useEndGrounding();
  const updateEquipment = useUpdateEquipment();
  const deleteEquipment = useDeleteEquipment();
  const equipmentCheckRules = useCheckRules(selectedEquipmentForMgmt);
  const createCheckRule = useCreateCheckRule();
  const updateEquipmentCheckRule = useUpdateCheckRule();
  const deleteCheckRule = useDeleteCheckRule();
  const updateCheckSheetDetail = useUpdateCheckSheetDetail();
  const deleteCheckSheetDetail = useDeleteCheckSheetDetail();
  const allCheckSheets = useAllCheckSheets();
  const uploadCheckSheetPdf = useUploadCheckSheetPdf();
  const deleteCheckSheetPdf = useDeleteCheckSheetPdf();
  const uploadCheckRuleTemplatePdf = useUploadCheckRuleTemplatePdf();
  const deleteCheckRuleTemplatePdf = useDeleteCheckRuleTemplatePdf();
  const uploadCompletedCheckPdf = useUploadCompletedCheckPdf();
  const deleteCompletedCheckPdf = useDeleteCompletedCheckPdf();
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState<string | null>(null);
  const [showPdfUploadModal, setShowPdfUploadModal] = useState<string | null>(null);
  const [showCompletedPdfUploadModal, setShowCompletedPdfUploadModal] = useState<string | null>(null);
  const [showRulePdfUploadModal, setShowRulePdfUploadModal] = useState<string | null>(null);
  const [pdfUploadFile, setPdfUploadFile] = useState<File | null>(null);
  const [selectedAllChecksSheet, setSelectedAllChecksSheet] = useState<CheckSheetManagementItem | null>(null);
  const [entriesReportStatusFilter, setEntriesReportStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [entriesReportEquipmentFilter, setEntriesReportEquipmentFilter] = useState("ALL");
  const [entriesReportDateFrom, setEntriesReportDateFrom] = useState("");
  const [entriesReportDateTo, setEntriesReportDateTo] = useState("");
  const [entriesReportSearch, setEntriesReportSearch] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryHours, setEditEntryHours] = useState("");
  const [showGroundEquipmentModal, setShowGroundEquipmentModal] = useState(false);
  const [showEndGroundingModal, setShowEndGroundingModal] = useState(false);
  const [groundFromDate, setGroundFromDate] = useState(new Date().toISOString().slice(0, 10));
  const [groundReason, setGroundReason] = useState("");
  const [groundEndDate, setGroundEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [historyEquipmentId, setHistoryEquipmentId] = useState<string | null>(null);
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"ALL" | "COMPLETED" | "MISSED" | "OVERDUE">("ALL");
  const [historyCheckCodeFilter, setHistoryCheckCodeFilter] = useState<string>("ALL");
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<{
    id: string;
    entryDate: string;
    hoursRun: number;
    createdBy: string | null;
    createdByEmail: string | null;
    approvedBy: string | null;
    approvedByEmail: string | null;
    approvedAt: string | null;
  } | null>(null);
  const [selectedHistoryCheck, setSelectedHistoryCheck] = useState<{
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
  } | null>(null);
  const [selectedHistoryGrounding, setSelectedHistoryGrounding] = useState<{
    id: string;
    fromDate: string;
    toDate: string | null;
    reason: string;
  } | null>(null);

  const allEntries = useAllEntries({
    status: entriesReportStatusFilter !== "ALL" ? entriesReportStatusFilter : undefined,
    equipmentId: entriesReportEquipmentFilter !== "ALL" ? entriesReportEquipmentFilter : undefined,
    dateFrom: entriesReportDateFrom || undefined,
    dateTo: entriesReportDateTo || undefined,
  });

  const filteredAllChecks = useMemo(() => {
    const rawAll: CheckSheetManagementItem[] = (checksheets.data ?? [])
      .filter((s) => s.status === "ISSUED" || s.status === "COMPLETED")
      .map((s) => {
        // Try to get additional data from allCheckSheets if available
        const mgmtData = allCheckSheets.data?.find((m) => m.id === s.id);
        return {
          id: s.id,
          equipmentId: s.equipmentId,
          equipmentNumber: s.equipmentNumber,
          equipmentName: s.equipmentName,
          usageUnit: (mgmtData?.usageUnit as "HOURS" | "KM") ?? "HOURS",
          checkCode: s.checkCode,
          dueHours: s.dueHours,
          dueDate: s.dueDate,
          triggerType: s.triggerType,
          status: s.status,
          issuedAt: mgmtData?.issuedAt ?? (s.status === "ISSUED" ? new Date().toISOString() : null),
          completedAt: mgmtData?.completedAt ?? (s.status === "COMPLETED" ? new Date().toISOString() : null),
          pdfFilePath: mgmtData?.pdfFilePath ?? null,
          completedHours: mgmtData?.completedHours ?? null,
        };
      });

    // All items in rawAll are already filtered to be ISSUED or COMPLETED, so we can use them directly
    const withEffective = rawAll;

    let result = withEffective;
    
    if (checkSheetMgmtSearch) {
      const search = checkSheetMgmtSearch.toLowerCase();
      result = result.filter((s) => 
        s.equipmentNumber.toLowerCase().includes(search) || 
        s.equipmentName.toLowerCase().includes(search) ||
        s.checkCode.toLowerCase().includes(search)
      );
    }
    
    if (checkSheetMgmtStatusFilter !== "ALL") {
      result = result.filter((s) => {
        const hasCompletedAt = s.completedAt !== null && s.completedAt !== undefined && s.completedAt !== "";
        const hasIssuedAt = s.issuedAt !== null && s.issuedAt !== undefined && s.issuedAt !== "";
        
        // Priority: completedAt > issuedAt > status
        let effectiveStatus: string;
        if (hasCompletedAt) {
          effectiveStatus = "COMPLETED";
        } else if (hasIssuedAt && !hasCompletedAt) {
          effectiveStatus = "ISSUED";
        } else {
          effectiveStatus = s.status;
        }
        
        return effectiveStatus === checkSheetMgmtStatusFilter;
      });
    }
    
    if (checkSheetMgmtEquipmentFilter !== "ALL") {
      result = result.filter((s) => s.equipmentNumber === checkSheetMgmtEquipmentFilter);
    }
    
    if (checkSheetMgmtCodeFilter !== "ALL") {
      result = result.filter((s) => s.checkCode === checkSheetMgmtCodeFilter);
    }
    
    if (checkSheetMgmtDateFrom) {
      const fromDate = new Date(checkSheetMgmtDateFrom);
      result = result.filter((s) => new Date(s.dueDate) >= fromDate);
    }
    
    if (checkSheetMgmtDateTo) {
      const toDate = new Date(checkSheetMgmtDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((s) => new Date(s.dueDate) <= toDate);
    }
    
    return result;
  }, [allCheckSheets.data, checkSheetMgmtSearch, checkSheetMgmtStatusFilter, checkSheetMgmtEquipmentFilter, checkSheetMgmtCodeFilter, checkSheetMgmtDateFrom, checkSheetMgmtDateTo]);

  const history = useEquipmentHistory(historyEquipmentId, {
    from: historyDateFrom || undefined,
    to: historyDateTo || undefined,
  });

  const handleExportHistory = () => {
    if (!history.data) {
      toast.error("No history to export");
      return;
    }
    const rows: string[] = [];
    rows.push("RecordType,Date,CodeOrReason,Status,Value,Extra");
    history.data.entries.forEach((e) => {
      rows.push(
        [
          "ENTRY",
          new Date(e.entryDate).toISOString(),
          "",
          "APPROVED",
          e.hoursRun.toFixed(2),
          `CreatedBy=${e.createdBy ?? ""};ApprovedBy=${e.approvedBy ?? ""}`,
        ].join(","),
      );
    });
    history.data.checks
      .filter((c) => c.status !== "PREDICTED")
      .forEach((c) => {
      rows.push(
        [
          "CHECK",
          new Date(c.dueDate).toISOString(),
          c.checkCode,
          c.status,
          c.dueHours.toFixed(2),
          `Missed=${c.isMissed};CompletedAt=${c.completedAt ?? ""}`,
        ].join(","),
      );
    });
    history.data.groundingPeriods.forEach((g) => {
      rows.push(
        [
          "GROUNDING",
          new Date(g.fromDate).toISOString(),
          g.reason.replace(/,/g, " "),
          "GROUNDED",
          "",
          `To=${g.toDate ?? ""}`,
        ].join(","),
      );
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeNumber = history.data.equipment.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
    link.download = `equipment_${safeNumber}_history.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (showEquipmentEditModal && equipmentDetail.data) {
      setEditEquipmentNumber(equipmentDetail.data.equipmentNumber);
      setEditDisplayName(equipmentDetail.data.displayName);
      setEditEquipmentClass(equipmentDetail.data.equipmentClass);
      setEditAvgHours(String(equipmentDetail.data.averageHoursPerDay));
      setEditCurrentHours(String(equipmentDetail.data.currentHours));
      setEditCommissionedAt(equipmentDetail.data.commissionedAt ? equipmentDetail.data.commissionedAt.slice(0, 10) : "");
      setEditIsActive(equipmentDetail.data.isActive);
      setEditUsageUnit(equipmentDetail.data.usageUnit);
    }
  }, [showEquipmentEditModal, equipmentDetail.data]);

  useEffect(() => {
    if (showCheckRuleModal && editingCheckRuleId && equipmentCheckRules.data) {
      const rule = equipmentCheckRules.data.find((r) => r.id === editingCheckRuleId);
      if (rule) {
        setCheckRuleCode(rule.code);
        setCheckRuleIntervalHours(String(rule.intervalHours));
        setCheckRuleIntervalTimeValue(rule.intervalTimeValue != null ? String(rule.intervalTimeValue) : "");
        setCheckRuleIntervalTimeUnit(rule.intervalTimeUnit ?? "MONTHS");
        setCheckRuleIsActive(rule.isActive);
      }
    } else if (showCheckRuleModal && !editingCheckRuleId) {
      setCheckRuleCode("A");
      setCheckRuleIntervalHours("500");
      setCheckRuleIntervalTimeValue("");
      setCheckRuleIntervalTimeUnit("MONTHS");
      setCheckRuleIsActive(true);
    }
  }, [showCheckRuleModal, editingCheckRuleId, equipmentCheckRules.data]);

  useEffect(() => {
    if (showCheckSheetModal && editingCheckSheetId && equipmentDetail.data) {
      const sheet = equipmentDetail.data.checkSheets.find((s) => s.id === editingCheckSheetId);
      if (sheet) {
        setCheckSheetCode(sheet.checkCode);
        setCheckSheetDueHours(String(sheet.dueHours));
        setCheckSheetDueDate(sheet.dueDate ? new Date(sheet.dueDate).toISOString().slice(0, 16) : "");
        setCheckSheetTriggerType(sheet.triggerType as "HOURS" | "CALENDAR");
        setCheckSheetStatus(sheet.status as typeof checkSheetStatus);
        setCheckSheetIssuedAt(sheet.issuedAt ? new Date(sheet.issuedAt).toISOString().slice(0, 16) : "");
        setCheckSheetCompletedAt(sheet.completedAt ? new Date(sheet.completedAt).toISOString().slice(0, 16) : "");
      }
    }
  }, [showCheckSheetModal, editingCheckSheetId, equipmentDetail.data]);

  const plan = useEquipmentPlan(selectedEquipmentId, year);
  const forecastMetrics = useForecastMetrics(selectedEquipmentId);
  const equipmentOptions = equipments.data ?? [];
  const bulkEquipmentList = useMemo(
    () =>
      [...equipmentOptions].sort((a, b) =>
        a.equipmentNumber.localeCompare(b.equipmentNumber),
      ),
    [equipmentOptions],
  );
  const stats = analytics.data;
  const allChecks = checksheets.data ?? [];
  const allAlerts = alerts.data ?? [];
  const notificationItems = notifications.data ?? [];
  const driftItems = forecastDrift.data ?? [];
  const catalog = permissionCatalog.data ?? [];

  const filteredAlerts = useMemo(() => {
    if (alertFilter === "ALL") return allAlerts;
    return allAlerts.filter((alert) => alert.level === alertFilter);
  }, [allAlerts, alertFilter]);

  const filteredChecks = useMemo(() => {
    // Overview should only show upcoming checks, not issued or completed ones
    let checks = allChecks.filter((check) => check.status !== "ISSUED" && check.status !== "COMPLETED");

    if (checkFilter !== "ALL") {
      checks = checks.filter((check) => check.status === checkFilter);
    }

    if (checkDateFrom) {
      const fromDate = new Date(checkDateFrom);
      checks = checks.filter((check) => new Date(check.dueDate) >= fromDate);
    }

    if (checkDateTo) {
      const toDate = new Date(checkDateTo);
      toDate.setHours(23, 59, 59, 999);
      checks = checks.filter((check) => new Date(check.dueDate) <= toDate);
    }

    if (checkEquipmentSearch.trim()) {
      const search = checkEquipmentSearch.toLowerCase().trim();
      checks = checks.filter((check) =>
        check.equipmentNumber.toLowerCase().includes(search) ||
        check.equipmentName.toLowerCase().includes(search)
      );
    }

    if (checkCodeFilter) {
      checks = checks.filter((check) => check.checkCode === checkCodeFilter);
    }

    if (checkTriggerTypeFilter !== "ALL") {
      checks = checks.filter((check) => check.triggerType === checkTriggerTypeFilter);
    }

    const now = new Date().getTime();
    return checks.sort((a, b) => {
      const daysA = Math.ceil((new Date(a.dueDate).getTime() - now) / (1000 * 60 * 60 * 24));
      const daysB = Math.ceil((new Date(b.dueDate).getTime() - now) / (1000 * 60 * 60 * 24));
      return daysA - daysB;
    });
  }, [allChecks, checkFilter, checkDateFrom, checkDateTo, checkEquipmentSearch, checkCodeFilter, checkTriggerTypeFilter]);

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case "APPROACHING":
        return {
          bg: "from-blue-100 to-blue-50",
          border: "border-blue-400",
          text: "text-blue-900",
          badge: "bg-blue-500 text-white"
        };
      case "ISSUE_REQUIRED":
        return {
          bg: "from-red-100 to-red-50",
          border: "border-red-400",
          text: "text-red-900",
          badge: "bg-red-500 text-white"
        };
      case "NEAR_DUE":
        return {
          bg: "from-blue-100 to-blue-50",
          border: "border-blue-400",
          text: "text-blue-900",
          badge: "bg-blue-500 text-white"
        };
      case "OVERDUE":
        return {
          bg: "from-red-800 to-red-700",
          border: "border-red-900",
          text: "text-white",
          badge: "bg-red-900 text-white"
        };
      default:
        return {
          bg: "from-gray-100 to-gray-50",
          border: "border-gray-300",
          text: "text-gray-800",
          badge: "bg-gray-500 text-white"
        };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PREDICTED":
        return {
          bg: "from-blue-100 to-blue-50",
          border: "border-blue-500",
          text: "text-blue-900",
          badge: "bg-blue-500 text-white"
        };
      case "NEAR_DUE":
        return {
          bg: "from-red-100 to-red-50",
          border: "border-red-600",
          text: "text-red-900",
          badge: "bg-red-600 text-white"
        };
      case "ISSUE_REQUIRED":
        return {
          bg: "from-yellow-100 to-yellow-50",
          border: "border-yellow-500",
          text: "text-yellow-900",
          badge: "bg-yellow-500 text-yellow-900"
        };
      case "OVERDUE":
        return {
          bg: "from-red-900 to-red-800",
          border: "border-red-900",
          text: "text-white",
          badge: "bg-red-900 text-white"
        };
      case "ISSUED":
        return {
          bg: "from-yellow-100 to-yellow-50",
          border: "border-yellow-500",
          text: "text-yellow-900",
          badge: "bg-yellow-500 text-yellow-900"
        };
      case "COMPLETED":
        return {
          bg: "from-green-100 to-green-50",
          border: "border-green-500",
          text: "text-green-900",
          badge: "bg-green-500 text-white"
        };
      default:
        return {
          bg: "from-gray-100 to-gray-50",
          border: "border-gray-300",
          text: "text-gray-800",
          badge: "bg-gray-500 text-white"
        };
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PREDICTED":
        return "Upcoming";
      case "ISSUE_REQUIRED":
        return "Due";
      case "NEAR_DUE":
        return "Critical";
      case "OVERDUE":
        return "Overdue";
      case "ISSUED":
        return "Issued";
      case "COMPLETED":
        return "Completed";
      default:
        return status;
    }
  };

  const getAlertLevelLabel = (level: string) => {
    switch (level) {
      case "APPROACHING":
        return "Upcoming";
      case "ISSUE_REQUIRED":
        return "Action Required";
      case "NEAR_DUE":
        return "Critical";
      case "OVERDUE":
        return "Overdue";
      default:
        return level;
    }
  };

  const selectedEquipment = useMemo(() => {
    if (!selectedEquipmentModal) return null;
    return equipmentOptions.find((eq) => eq.id === selectedEquipmentModal);
  }, [equipmentOptions, selectedEquipmentModal]);

  const selectedAlert = useMemo(() => {
    if (!selectedAlertModal) return null;
    return allAlerts.find((alert) => alert.id === selectedAlertModal);
  }, [allAlerts, selectedAlertModal]);

  const planByWeek = useMemo(() => {
    const weeks = Array.from({ length: 53 }, (_, index) => ({
      week: index + 1,
      labels: [] as string[],
    }));
    for (const item of plan.data ?? []) {
      const target = weeks[item.week - 1];
      if (target) {
        target.labels.push(item.checkCode);
      }
    }
    return weeks;
  }, [plan.data]);

  const loadPermissionMap = (userId: string) => {
    const selected = (users.data ?? []).find((item) => item.id === userId);
    const base = Object.fromEntries(catalog.map((item) => [item.key, false]));
    for (const permission of selected?.permissions ?? []) {
      base[permission.key] = permission.allowed;
    }
    setPermissionMap(base);
  };

  const filteredEquipment = useMemo(() => {
    if (!equipmentSearch.trim()) return equipmentOptions;
    const search = equipmentSearch.toLowerCase();
    return equipmentOptions.filter(
      (eq) =>
        eq.equipmentNumber.toLowerCase().includes(search) ||
        eq.displayName.toLowerCase().includes(search)
    );
  }, [equipmentOptions, equipmentSearch]);

  const onEntrySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (bulkMode) {
      return;
    }

    const selectedEquipment = selectedEquipmentId ? equipmentOptions.find((e) => e.id === selectedEquipmentId) : null;
    const enteredHours = Number(entryHours);

    let hasError = false;

    if (!selectedEquipmentId || !selectedEquipment) {
      setEquipmentError("Please select a valid equipment");
      hasError = true;
    } else {
      setEquipmentError(undefined);
    }

    if (!entryHours || enteredHours <= 0) {
      setHoursError("Hours must be greater than 0");
      hasError = true;
    } else if (selectedEquipment && enteredHours < selectedEquipment.currentHours) {
      setHoursError(`Hours must be at least ${selectedEquipment.currentHours.toFixed(2)} (current equipment hours)`);
      hasError = true;
    } else {
      setHoursError(undefined);
    }

    if (hasError || !selectedEquipmentId) {
      return;
    }

    createEntry.mutate(
      {
        equipmentId: selectedEquipmentId,
        entryDate: new Date(`${entryDate}T00:00:00.000Z`).toISOString(),
        hoursRun: enteredHours,
      },
      {
        onSuccess: () => {
          const equipment = equipmentOptions.find((e) => e.id === selectedEquipmentId);
          toast.success(`Entry recorded for ${equipment?.equipmentNumber || "equipment"}`);
          setSelectedEquipmentId(null);
          setEntryHours("0");
          setEquipmentSearch("");
          setEquipmentError(undefined);
          setHoursError(undefined);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to create entry");
        },
      }
    );
  };

  const onBulkSubmit = async () => {
    if (bulkEntries.length === 0) return;
    const date = new Date(`${entryDate}T00:00:00.000Z`).toISOString();
    const validEntries = bulkEntries.filter((e) => {
      if (!e.equipmentId || !e.hours) return false;
      const value = Number(e.hours);
      if (Number.isNaN(value) || value <= 0) return false;
      return value >= e.previous;
    });
    let successCount = 0;
    let errorCount = 0;
    const failureDetails: Array<{ equipment: string; message: string }> = [];

    for (const entry of validEntries) {
      try {
        await createEntry.mutateAsync({
          equipmentId: entry.equipmentId,
          entryDate: date,
          hoursRun: Number(entry.hours),
        });
        successCount++;
      } catch (error) {
        errorCount++;
        const equipment = bulkEquipmentList.find((eq) => eq.id === entry.equipmentId);
        let message = "Unknown error";
        if (error instanceof Error) {
          message = error.message;
        } else if (typeof error === "string") {
          message = error;
        }
        failureDetails.push({
          equipment: equipment?.equipmentNumber ?? entry.equipmentId,
          message,
        });
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully created ${successCount} entr${successCount === 1 ? "y" : "ies"} out of ${validEntries.length}`);
    }
    if (errorCount > 0) {
      const topFailures = failureDetails.slice(0, 3)
        .map((item) => `${item.equipment}: ${item.message}`)
        .join(" | ");
      const moreCount = errorCount - Math.min(errorCount, 3);
      const moreText = errorCount > 3 && moreCount > 0 ? ` | and ${moreCount} more` : "";
      toast.error(`${topFailures}${moreText}`);
    }

    setBulkEntries([]);
  };

  const handleEquipmentSelect = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    setEquipmentSearch("");
    setEquipmentSearchOpen(false);
    setEquipmentSearchIndex(-1);
    setEquipmentError(undefined);
    const selectedEquipment = equipmentOptions.find((e) => e.id === equipmentId);
    if (selectedEquipment && Number(entryHours) > 0 && Number(entryHours) < selectedEquipment.currentHours) {
      setHoursError(`Hours must be at least ${selectedEquipment.currentHours.toFixed(2)} (current equipment hours)`);
    } else {
      setHoursError(undefined);
    }
    setTimeout(() => {
      const hoursInput = document.getElementById("hours-run-input") as HTMLInputElement;
      hoursInput?.focus();
    }, 50);
  };

  const handleEquipmentKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setEquipmentSearchOpen(true);
      setEquipmentSearchIndex((prev) =>
        prev < filteredEquipment.length - 1 ? prev + 1 : prev
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setEquipmentSearchIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (event.key === "Enter" && equipmentSearchIndex >= 0) {
      event.preventDefault();
      const selected = filteredEquipment[equipmentSearchIndex];
      if (selected) {
        handleEquipmentSelect(selected.id);
      }
    } else if (event.key === "Enter" && filteredEquipment.length === 1) {
      event.preventDefault();
      handleEquipmentSelect(filteredEquipment[0].id);
    } else if (event.key === "Escape") {
      setEquipmentSearchOpen(false);
      setEquipmentSearchIndex(-1);
    }
  };

  const handleHoursKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && selectedEquipmentId && entryHours) {
      event.preventDefault();
      const form = event.currentTarget.closest("form");
      form?.requestSubmit();
    }
  };

  const addCheckRule = () => {
    const usedCodes = new Set(checkRules.map((r) => r.code.toUpperCase()));
    const nextCode = String.fromCharCode(
      Math.min(
        ...Array.from({ length: 26 }, (_, i) => i + 65)
          .filter((code) => !usedCodes.has(String.fromCharCode(code)))
      )
    );
    setCheckRules([...checkRules, { code: nextCode || "A", intervalHours: "0" }]);
  };

  const removeCheckRule = (index: number) => {
    setCheckRules(checkRules.filter((_, i) => i !== index));
  };

  const updateCheckRule = (index: number, field: "code" | "intervalHours", value: string) => {
    setCheckRules(
      checkRules.map((rule, i) => {
        if (i === index) {
          if (field === "code") {
            return { ...rule, code: value.toUpperCase().slice(0, 1) };
          } else {
            return { ...rule, intervalHours: value };
          }
        }
        return rule;
      })
    );
  };

  const onCreateEquipment = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const uniqueCodes = new Set(checkRules.map((r) => r.code.toUpperCase()));
    if (uniqueCodes.size !== checkRules.length) {
      toast.error("Check codes must be unique (A-Z)");
      return;
    }

    const invalidRules = checkRules.filter(
      (r) => !/^[A-Z]$/.test(r.code) || !r.intervalHours || Number(r.intervalHours) <= 0
    );
    if (invalidRules.length > 0) {
      toast.error("All check codes must be A-Z and interval hours must be positive");
      return;
    }

    if (
      (previousCheckCode && !previousCheckDate) ||
      (!previousCheckCode && previousCheckDate)
    ) {
      toast.error("Previous check code and date must be provided together");
      return;
    }

    if (previousCheckCode) {
      const hasMatchingRule = checkRules.some(
        (rule) => rule.code.toUpperCase() === previousCheckCode.toUpperCase()
      );
      if (!hasMatchingRule) {
        toast.error("Previous check code must match one of the check rules");
        return;
      }
    }

    const processedRules = checkRules.map((rule) => {
      const interval = Number(rule.intervalHours);
      return {
        code: rule.code.toUpperCase(),
        intervalHours: interval,
        approachingOffsetHours: Math.max(0, Math.floor(interval * 0.3)),
        issueOffsetHours: Math.max(0, Math.floor(interval * 0.1)),
        nearOffsetHours: Math.max(0, Math.floor(interval * 0.03)),
      };
    });

    createEquipment.mutate(
      {
        equipmentNumber,
        displayName: equipmentDisplayName || equipmentNumber,
        equipmentClass: "GENERAL",
        averageHoursPerDay: Number(avgHours),
        currentHours: Number(currentHours),
        usageUnit: createUsageUnit,
        checkRules: processedRules,
        previousCheckCode: previousCheckCode.trim() || undefined,
        previousCheckDate: previousCheckDate || undefined,
      },
      {
        onSuccess: () => {
          toast.success(`Equipment ${equipmentNumber} created successfully`);
          setEquipmentNumber("");
          setEquipmentDisplayName("");
          setAvgHours("8");
          setCurrentHours("0");
          setCreateUsageUnit("HOURS");
          setPreviousCheckCode("");
          setPreviousCheckDate("");
          setCheckRules([{ code: "A", intervalHours: "500" }]);
          setShowEquipmentCreateModal(false);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to create equipment");
        },
      }
    );
  };

  const onCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUser.mutate(
      {
        fullName: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      },
      {
        onSuccess: () => {
          toast.success(`User ${newUserName} created successfully`);
          setNewUserName("");
          setNewUserEmail("");
          setNewUserPassword("");
          setNewUserRole("USER");
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Failed to create user");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f4f7fb] via-[#e7eef8] to-[#f4f7fb]">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(11,61,145,0.15),transparent_50%),radial-gradient(circle_at_90%_80%,rgba(215,38,61,0.12),transparent_50%)] pointer-events-none" />
      
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[var(--color-primary)]/10 via-white to-[var(--color-accent)]/10 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden rounded-xl p-2.5 transition-all bg-gradient-to-br from-[var(--color-primary)]/20 to-[var(--color-primary)]/10 hover:from-[var(--color-primary)]/30 hover:to-[var(--color-primary)]/20 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-primary)]/20"
            >
              <span className="text-xl">☰</span>
            </button>
            <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)]/20 via-white to-[var(--color-accent)]/20 p-3 shadow-2xl shadow-[var(--color-primary)]/30 ring-2 ring-[var(--color-accent)]/20">
              <img 
                src={`${BASE_PATH}/logo.png`} 
                alt="GrSD Logo" 
                width={42} 
                height={42} 
                className="shrink-0 object-contain max-w-full h-auto"
                style={{ display: 'block' }}
              />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold uppercase tracking-widest bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">GRSD</p>
              <p className="text-sm font-bold text-[var(--color-text)]">Planning Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center gap-2 sm:gap-3 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 transition-all bg-gradient-to-r from-[var(--color-primary)]/15 to-[var(--color-accent)]/10 hover:from-[var(--color-primary)]/25 hover:to-[var(--color-accent)]/20 hover:scale-105 active:scale-95 shadow-lg shadow-[var(--color-primary)]/20"
              >
                <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-accent)] text-sm font-bold text-white shadow-xl shadow-[var(--color-primary)]/50 ring-2 ring-white/50">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-bold text-[var(--color-text)]">{user.fullName}</p>
                  <p className="text-xs font-medium text-[var(--color-text-soft)]">{user.role}</p>
                </div>
                <svg
                  className={`h-4 w-4 text-[var(--color-text-soft)] transition-transform ${profileMenuOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-gradient-to-br from-white via-white to-[var(--color-surface)] backdrop-blur-xl shadow-2xl overflow-hidden ring-4 ring-[var(--color-primary)]/10">
                  <div className="bg-gradient-to-r from-[var(--color-primary)]/20 via-[var(--color-primary)]/15 to-[var(--color-accent)]/15 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-accent)] text-lg font-bold text-white shadow-xl shadow-[var(--color-primary)]/50 ring-3 ring-white/50">
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text)] truncate">{user.fullName}</p>
                        <p className="text-xs font-medium text-[var(--color-text-soft)] truncate">{user.email}</p>
                        <div className="mt-1">
                          <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                            {user.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-gradient-to-b from-transparent to-[var(--color-surface)]/30">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout.mutate(undefined, {
                          onSuccess: () => {
                            toast.success("Signed out successfully");
                          },
                          onError: (error) => {
                            toast.error(error instanceof Error ? error.message : "Failed to sign out");
                          },
                        });
                      }}
                      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] text-white transition-all hover:from-[var(--color-accent-dark)] hover:to-[var(--color-accent)] hover:scale-[1.02] active:scale-95 shadow-lg shadow-[var(--color-accent)]/30"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:pl-[280px]">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gradient-to-b from-[var(--color-primary)]/10 via-white to-[var(--color-accent)]/10 backdrop-blur-xl shadow-2xl transition-transform lg:fixed lg:top-[73px] lg:bottom-0 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <nav className="flex-1 overflow-y-auto p-4 space-y-3 pt-6">
              {sections
                .filter((s) => s.key !== "pending-approvals" || canAdmin)
                .map((section) => {
                  const pendingCount = section.key === "pending-approvals" ? pendingEntries.data?.length ?? 0 : 0;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => {
                        setActiveSection(section.key);
                        setSidebarOpen(false);
                      }}
                      className={`group relative w-full rounded-xl px-4 py-3.5 text-left transition-all duration-200 ${
                        activeSection === section.key
                          ? "bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-accent)] text-white shadow-2xl shadow-[var(--color-primary)]/50 scale-[1.02] ring-2 ring-white/30"
                          : "text-[var(--color-text)] bg-gradient-to-r from-transparent to-[var(--color-primary)]/5 hover:from-[var(--color-primary)]/15 hover:to-[var(--color-accent)]/10 hover:scale-[1.01] hover:shadow-lg"
                      }`}
                    >
                      {activeSection === section.key && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-white rounded-r-full shadow-lg" />
                      )}
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center">
                          <span className={`mr-3 text-xl transition-transform ${activeSection === section.key ? "scale-110 drop-shadow-lg" : "group-hover:scale-110"}`}>
                            {section.icon}
                          </span>
                          <span className="text-sm font-bold">{section.label}</span>
                        </div>
                        {pendingCount > 0 && (
                          <span className="min-w-[22px] rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-bold text-yellow-900">
                            {pendingCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
            </nav>
            <div className="p-4 bg-gradient-to-r from-[var(--color-primary)]/15 via-[var(--color-primary)]/10 to-[var(--color-accent)]/10">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-accent)]/15 shadow-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-dark)] to-[var(--color-accent)] text-xs font-bold text-white shadow-md ring-2 ring-white/50">
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[var(--color-text)] truncate">{user.fullName}</p>
                  <p className="text-[10px] font-medium text-[var(--color-text-soft)] truncate">{user.role}</p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="relative flex-1 space-y-6 lg:ml-0">
          {activeSection === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard 
                  title="Total Equipment" 
                  value={String(stats?.equipmentCount ?? 0)} 
                  accent="primary"
                  icon="🔧"
                  description="Active equipment"
                  statusColor="blue"
                  onClick={() => setActiveSection("admin")}
                />
                <StatCard 
                  title="Active Alerts" 
                  value={String(stats?.activeAlerts ?? 0)} 
                  accent="accent"
                  icon="⚠️"
                  description="Requires attention"
                  badge={(stats?.activeAlerts ?? 0) > 0 ? stats?.activeAlerts : undefined}
                  statusColor={(stats?.activeAlerts ?? 0) > 0 ? "red" : "blue"}
                  onClick={() => {
                    setActiveSection("checks");
                    setCheckFilter("ISSUE_REQUIRED");
                  }}
                />
                <StatCard 
                  title="Today's Entries" 
                  value={String(stats?.todayEntries ?? 0)} 
                  accent="primary"
                  icon="📊"
                  description="Hours logged today"
                  statusColor="green"
                  onClick={() => setActiveSection("entries")}
                />
                {canAdmin && (
                  <StatCard 
                    title="Pending Approvals" 
                    value={String(pendingEntries.data?.length ?? 0)} 
                    accent="primary"
                    icon="⏳"
                    description="Awaiting review"
                    badge={(pendingEntries.data?.length ?? 0) > 0 ? pendingEntries.data?.length : undefined}
                    statusColor={(pendingEntries.data?.length ?? 0) > 0 ? "yellow" : "green"}
                    onClick={() => setActiveSection("pending-approvals")}
                  />
                )}
                <StatCard 
                  title="Due Soon" 
                  value={String(stats?.checksDueSoon ?? 0)} 
                  accent="accent"
                  icon="⏰"
                  description="Within 14 days"
                  statusColor={(stats?.checksDueSoon ?? 0) > 0 ? "yellow" : "blue"}
                  onClick={() => {
                    setActiveSection("checks");
                    const today = new Date();
                    const in14Days = new Date(today);
                    in14Days.setDate(today.getDate() + 14);
                    setCheckDateFrom(today.toISOString().slice(0, 10));
                    setCheckDateTo(in14Days.toISOString().slice(0, 10));
                    setCheckFilter("ALL");
                  }}
                />
                <StatCard 
                  title="Unread Notifications" 
                  value={String(stats?.unreadNotifications ?? 0)} 
                  accent="primary"
                  icon="🔔"
                  description="Pending review"
                  badge={(stats?.unreadNotifications ?? 0) > 0 ? stats?.unreadNotifications : undefined}
                  statusColor={(stats?.unreadNotifications ?? 0) > 0 ? "yellow" : "green"}
                  onClick={() => {
                    if ((stats?.unreadNotifications ?? 0) > 0) {
                      setActiveSection("checks");
                      setCheckFilter("ISSUE_REQUIRED");
                    }
                  }}
                />
                <StatCard 
                  title="Overdue Checks" 
                  value={String(stats?.overdueEscalations ?? 0)} 
                  accent="accent"
                  icon="🚨"
                  description="Immediate action"
                  badge={(stats?.overdueEscalations ?? 0) > 0 ? stats?.overdueEscalations : undefined}
                  statusColor={(stats?.overdueEscalations ?? 0) > 0 ? "red" : "green"}
                  onClick={() => {
                    setActiveSection("checks");
                    setCheckFilter("OVERDUE");
                  }}
                />
              </div>

              <Card title="Upcoming Maintenance Checks">
                  <div className="mb-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                        <select
                          value={checkFilter}
                          onChange={(e) => setCheckFilter(e.target.value as typeof checkFilter)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="ALL">All Status</option>
                          <option value="PREDICTED">Scheduled</option>
                          <option value="ISSUE_REQUIRED">Action Required</option>
                          <option value="NEAR_DUE">Critical</option>
                          <option value="OVERDUE">Overdue</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                        <input
                          type="text"
                          value={checkEquipmentSearch}
                          onChange={(e) => setCheckEquipmentSearch(e.target.value)}
                          placeholder="Search equipment..."
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                        <select
                          value={checkCodeFilter}
                          onChange={(e) => setCheckCodeFilter(e.target.value)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="">All Codes</option>
                          {Array.from(new Set(allChecks.map(c => c.checkCode).sort())).map(code => (
                            <option key={code} value={code}>Check {code}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Trigger Type</label>
                        <select
                          value={checkTriggerTypeFilter}
                          onChange={(e) => setCheckTriggerTypeFilter(e.target.value as typeof checkTriggerTypeFilter)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="ALL">All Types</option>
                          <option value="HOURS">Hours-based</option>
                          <option value="CALENDAR">Calendar-based</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                        <input
                          type="date"
                          value={checkDateFrom}
                          onChange={(e) => setCheckDateFrom(e.target.value)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                        <input
                          type="date"
                          value={checkDateTo}
                          onChange={(e) => setCheckDateTo(e.target.value)}
                          min={checkDateFrom || undefined}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                          Showing {filteredChecks.length} of {allChecks.filter((check) => check.status !== "ISSUED" && check.status !== "COMPLETED").length} upcoming checks
                        </span>
                        {(checkDateFrom || checkDateTo || checkEquipmentSearch || checkCodeFilter || checkTriggerTypeFilter !== "ALL" || checkFilter !== "ALL") && (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckFilter("ALL");
                              setCheckDateFrom("");
                              setCheckDateTo("");
                              setCheckEquipmentSearch("");
                              setCheckCodeFilter("");
                              setCheckTriggerTypeFilter("ALL");
                            }}
                            className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveSection("checks")}
                        className="text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors"
                      >
                        View All →
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {filteredChecks.map((check) => {
                      const colors = getStatusColor(check.status);
                      const daysUntilDue = Math.ceil((new Date(check.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <div 
                          key={check.id} 
                          className={`group rounded-lg border-2 bg-gradient-to-br ${colors.bg} ${colors.border} p-4 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}
                          onClick={() => setSelectedEquipmentModal(check.equipmentId)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.badge} whitespace-nowrap`}>
                                  {daysUntilDue > 0 ? `${daysUntilDue} days` : daysUntilDue === 0 ? "Due today" : `${Math.abs(daysUntilDue)} days overdue`}
                                </span>
                                <p className={`text-base font-bold ${colors.text}`}>{check.equipmentNumber}</p>
                                <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
                                  Check {check.checkCode}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap ${colors.badge}`}>
                                  {getStatusLabel(check.status)}
                                </span>
                              </div>
                              <div className="space-y-1.5">
                                <p className={`text-sm font-semibold ${colors.text}`}>
                                  Due: {formatDate(check.dueDate)} at {check.dueHours.toFixed(0)} {check.usageUnit === "KM" ? "km" : "hours"}
                                </p>
                                <p className={`text-xs font-medium ${colors.text} opacity-75`}>
                                  {check.triggerType === "HOURS" ? "Hours-based" : "Calendar-based"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredChecks.length === 0 && (
                      <div className="py-12 text-center">
                        <p className="text-sm font-medium text-[var(--color-text-soft)]">No checks found</p>
                        <p className="text-xs text-[var(--color-text-soft)] mt-1">All maintenance checks are up to date</p>
                      </div>
                    )}
                  </div>
                </Card>

              {selectedEquipmentModal && selectedEquipment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedEquipmentModal(null)}>
                  <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedEquipmentModal(null)}
                      className="absolute top-4 right-4 rounded-lg p-2 hover:bg-[var(--color-surface-strong)] transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">Equipment Details</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Equipment Number</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.equipmentNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Display Name</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.displayName}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Equipment Class</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.equipmentClass}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Current Hours</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.currentHours.toFixed(2)} hours</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Average Hours/Day</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.averageHoursPerDay.toFixed(2)} hours</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">Active Check Rules</p>
                          <p className="text-sm font-bold text-[var(--color-text)]">{selectedEquipment.activeRuleCount} rules</p>
                        </div>
                      </div>
                      <div className="pt-4 border-t-2 border-[var(--color-surface-strong)]">
                        <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Related Maintenance Checks</p>
                        <div className="space-y-2">
                          {allChecks.filter(c => c.equipmentId === selectedEquipment.id).slice(0, 5).map((check) => {
                            const colors = getStatusColor(check.status);
                            return (
                              <div key={check.id} className={`rounded-lg border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-3`}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className={`text-xs font-bold ${colors.text}`}>Check {check.checkCode} - {getStatusLabel(check.status)}</p>
                                    <p className={`text-[10px] font-medium mt-1 ${colors.text} opacity-80`}>Due: {formatDate(check.dueDate)} at {check.dueHours.toFixed(0)} {check.usageUnit === "KM" ? "km" : "hours"}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedAlertModal && selectedAlert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedAlertModal(null)}>
                  <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setSelectedAlertModal(null)}
                      className="absolute top-4 right-4 rounded-lg p-2 hover:bg-[var(--color-surface-strong)] transition-colors"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {(() => {
                      const colors = getAlertLevelColor(selectedAlert.level);
                      return (
                        <div className={`rounded-lg border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-4 mb-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${colors.badge}`}>
                              {getAlertLevelLabel(selectedAlert.level)}
                            </span>
                          </div>
                          <h3 className={`text-lg font-bold mb-2 ${colors.text}`}>{selectedAlert.equipmentNumber}</h3>
                          <p className={`text-sm font-medium ${colors.text}`}>{selectedAlert.message}</p>
                          <p className={`text-xs font-medium mt-2 opacity-70 ${colors.text}`}>Created: {formatDate(selectedAlert.createdAt)}</p>
                        </div>
                      );
                    })()}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          acknowledgeAlert.mutate(selectedAlert.id, {
                            onSuccess: () => {
                              toast.success("Alert acknowledged");
                              setSelectedAlertModal(null);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to acknowledge alert");
                            },
                          });
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                      >
                        Acknowledge Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const equipment = equipmentOptions.find(e => e.equipmentNumber === selectedAlert.equipmentNumber);
                          if (equipment) {
                            setSelectedAlertModal(null);
                            setSelectedEquipmentModal(equipment.id);
                          }
                        }}
                        className="w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 border-2 border-[var(--color-primary)]/30 px-4 py-3 text-sm font-bold text-[var(--color-primary)] transition-all hover:scale-[1.02] hover:bg-[var(--color-primary)]/15"
                      >
                        View Equipment Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {activeSection === "entries" && (
            <div className="space-y-6">
              <Card title="Daily Entry">
                <div className="mb-6 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMode(false);
                      setSelectedEquipmentId(null);
                      setEquipmentSearch("");
                      setEntryHours("0");
                    }}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                      !bulkMode
                        ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg shadow-[var(--color-primary)]/30 scale-[1.02]"
                        : "bg-gradient-to-br from-white to-[var(--color-surface)] text-[var(--color-text)] border-2 border-[var(--color-surface-strong)] hover:border-[var(--color-primary)]/30"
                    }`}
                  >
                    Single Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkMode(true);
                      setBulkEntries(
                        bulkEquipmentList.map((eq) => {
                          const previous = Number(eq.currentHours ?? 0);
                          return {
                            equipmentId: eq.id,
                            hours: previous.toFixed(2),
                            previous,
                            error: undefined,
                          };
                        }),
                      );
                    }}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                      bulkMode
                        ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] text-white shadow-lg shadow-[var(--color-primary)]/30 scale-[1.02]"
                        : "bg-gradient-to-br from-white to-[var(--color-surface)] text-[var(--color-text)] border-2 border-[var(--color-surface-strong)] hover:border-[var(--color-primary)]/30"
                    }`}
                  >
                    Bulk Entry
                  </button>
                </div>

                {!bulkMode ? (
                  <form className="space-y-5" onSubmit={onEntrySubmit}>
                    <div className="relative" ref={equipmentSearchRef}>
                      <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Equipment Number</label>
                      <input
                        type="text"
                        value={
                          selectedEquipmentId
                            ? equipmentOptions.find((e) => e.id === selectedEquipmentId)?.equipmentNumber || ""
                            : equipmentSearch
                        }
                        onChange={(e) => {
                          setEquipmentSearch(e.target.value);
                          setEquipmentSearchOpen(true);
                          setSelectedEquipmentId(null);
                          setEquipmentSearchIndex(-1);
                          setEquipmentError(undefined);
                        }}
                        onFocus={() => setEquipmentSearchOpen(true)}
                        onKeyDown={handleEquipmentKeyDown}
                        onBlur={() => {
                          setTimeout(() => {
                            if (!selectedEquipmentId && equipmentSearch.trim() && filteredEquipment.length === 0) {
                              setEquipmentError("Invalid equipment number");
                            } else if (!selectedEquipmentId && equipmentSearch.trim()) {
                              setEquipmentError("Please select an equipment from the list");
                            }
                          }, 200);
                        }}
                        className={`h-12 w-full rounded-xl border-2 ${equipmentError ? "border-red-400" : "border-[var(--color-surface-strong)]"} bg-white px-4 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm`}
                        placeholder="Type to search equipment..."
                        autoComplete="off"
                      />
                      {equipmentError && (
                        <p className="mt-1 text-xs font-medium text-red-600">{equipmentError}</p>
                      )}
                      {equipmentSearchOpen && filteredEquipment.length > 0 && (
                        <div className="fixed z-[9999] mt-2 max-h-60 w-[calc(100vw-2rem)] sm:w-auto min-w-[200px] overflow-auto rounded-xl border-2 border-[var(--color-surface-strong)] bg-white shadow-2xl" style={{ 
                          top: typeof window !== 'undefined' && equipmentSearchRef.current ? (equipmentSearchRef.current.getBoundingClientRect().bottom || 0) + window.scrollY + 4 : 'auto',
                          left: typeof window !== 'undefined' && equipmentSearchRef.current ? (equipmentSearchRef.current.getBoundingClientRect().left || 0) + window.scrollX : 'auto',
                          width: typeof window !== 'undefined' && equipmentSearchRef.current ? `${equipmentSearchRef.current.getBoundingClientRect().width}px` : 'auto',
                        }}>
                          {filteredEquipment.map((eq, index) => (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => handleEquipmentSelect(eq.id)}
                              className={`w-full px-4 py-3 text-left transition-colors ${
                                index === equipmentSearchIndex
                                  ? "bg-gradient-to-r from-[var(--color-primary)]/20 to-[var(--color-primary)]/10"
                                  : "hover:bg-gradient-to-r hover:from-[var(--color-primary)]/10 hover:to-transparent"
                              }`}
                            >
                              <p className="text-sm font-bold text-[var(--color-text)]">
                                {eq.equipmentNumber}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Date</label>
                        <input 
                          type="date" 
                          required 
                          value={entryDate} 
                          onChange={(e) => setEntryDate(e.target.value)} 
                          className="h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">
                          {(() => {
                            const selected = selectedEquipmentId ? equipmentOptions.find((e) => e.id === selectedEquipmentId) : null;
                            if (selected?.usageUnit === "KM") return "Kilometers";
                            return "Hours Run";
                          })()}
                        </label>
                        <input
                          id="hours-run-input"
                          type="number"
                          required
                          min={selectedEquipmentId ? equipmentOptions.find((e) => e.id === selectedEquipmentId)?.currentHours || 0.1 : 0.1}
                          step={0.1}
                          value={entryHours}
                          onChange={(e) => {
                            setEntryHours(e.target.value);
                            const hours = Number(e.target.value);
                            const selectedEquipment = selectedEquipmentId ? equipmentOptions.find((eq) => eq.id === selectedEquipmentId) : null;
                            if (selectedEquipment && hours > 0 && hours < selectedEquipment.currentHours) {
                              const label = selectedEquipment.usageUnit === "KM" ? "Kilometers" : "Hours";
                              setHoursError(`${label} must be at least ${selectedEquipment.currentHours.toFixed(2)} (current equipment value)`);
                            } else {
                              setHoursError(undefined);
                            }
                          }}
                          onKeyDown={handleHoursKeyDown}
                          className={`h-12 w-full rounded-xl border-2 ${hoursError ? "border-red-400" : "border-[var(--color-surface-strong)]"} bg-white px-4 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm`}
                          placeholder={selectedEquipmentId ? (equipmentOptions.find((e) => e.id === selectedEquipmentId) ? `Min: ${equipmentOptions.find((e) => e.id === selectedEquipmentId)!.currentHours.toFixed(1)}` : "0.0") : "0.0"}
                        />
                        {hoursError && (
                          <p className="mt-1 text-xs font-medium text-red-600">{hoursError}</p>
                        )}
                      </div>
                    </div>
                    <button 
                      type="submit" 
                      disabled={!selectedEquipmentId || !entryHours || Number(entryHours) <= 0 || !!equipmentError || !!hoursError}
                      className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--color-accent)]/30 transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    >
                      Submit Entry
                    </button>
                  </form>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Entry Date</label>
                      <input 
                        type="date" 
                        required 
                        value={entryDate} 
                        onChange={(e) => setEntryDate(e.target.value)} 
                        className="h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-bold text-[var(--color-text)]">Equipment Entries</label>
                        <span className="text-xs font-medium text-[var(--color-text-soft)]">
                          {bulkEntries.filter((e) => {
                            const value = Number(e.hours);
                            return e.equipmentId && !Number.isNaN(value) && value > 0 && value >= e.previous;
                          }).length}{" "}
                          of {bulkEntries.length} ready
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                        {bulkEntries.map((entry, index) => {
                          const equipment = bulkEquipmentList.find((eq) => eq.id === entry.equipmentId);
                          const previous = entry.previous;
                          const value = entry.hours ? Number(entry.hours) : 0;
                          const hasError = entry.hours !== "" && (Number.isNaN(value) || value < previous);
                          const unitLabel = equipment?.usageUnit === "KM" ? "Kilometers" : "Hours";

                          return (
                            <div
                              key={entry.equipmentId}
                              className={`flex gap-4 items-center p-3 rounded-xl border-2 ${hasError ? "border-red-400" : "border-[var(--color-surface-strong)]"} bg-gradient-to-br from-white to-[var(--color-surface)] shadow-sm`}
                            >
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-[var(--color-text)]">
                                  {equipment?.equipmentNumber}{" "}
                                  <span className="text-[10px] font-medium text-[var(--color-text-soft)]">
                                    {equipment?.displayName}
                                  </span>
                                </p>
                                <p className="text-[10px] text-[var(--color-text-soft)] mt-1">
                                  Previous {unitLabel}: {previous.toFixed(2)}
                                </p>
                              </div>
                              <div className="w-40">
                                <input
                                  type="number"
                                  min={previous}
                                  step={0.1}
                                  value={entry.hours}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    setBulkEntries((prev) =>
                                      prev.map((item, i) =>
                                        i === index ? { ...item, hours: newValue } : item,
                                      ),
                                    );
                                  }}
                                  onFocus={(e) => e.target.select()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      const numeric = Number(entry.hours);
                                      if (!Number.isNaN(numeric) && numeric >= previous) {
                                        const nextIndex = index + 1;
                                        if (nextIndex < bulkEntries.length) {
                                          const hoursInput = document.getElementById(
                                            `bulk-hours-${nextIndex}`,
                                          ) as HTMLInputElement | null;
                                          hoursInput?.focus();
                                        }
                                      }
                                    }
                                  }}
                                  className={`h-11 w-full rounded-lg border-2 ${
                                    hasError
                                      ? "border-red-400"
                                      : "border-[var(--color-surface-strong)]"
                                  } bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 shadow-sm`}
                                  placeholder={`Min: ${previous.toFixed(2)}`}
                                  id={`bulk-hours-${index}`}
                                />
                                {hasError && (
                                  <p className="mt-1 text-xs font-medium text-red-600">
                                    {unitLabel} must be at least {previous.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onBulkSubmit}
                      disabled={bulkEntries.length === 0 || bulkEntries.every((e) => {
                        if (!e.equipmentId || !e.hours) return true;
                        const value = Number(e.hours);
                        if (Number.isNaN(value) || value <= 0) return true;
                        return value < e.previous;
                      })}
                      className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--color-accent)]/30 transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                    >
                      Submit All Entries ({bulkEntries.filter((e) => {
                        if (!e.equipmentId || !e.hours) return false;
                        const value = Number(e.hours);
                        if (Number.isNaN(value) || value <= 0) return false;
                        return value >= e.previous;
                      }).length})
                    </button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "entries-report" && (
            <div className="space-y-6">
              {canAdmin ? (
                <Card title="Entries Report">
                  {allEntries.isLoading ? (
                    <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
                      Loading entries...
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Search</label>
                            <input
                              type="text"
                              value={entriesReportSearch}
                              onChange={(e) => setEntriesReportSearch(e.target.value)}
                              placeholder="Equipment number, name..."
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                            <select
                              value={entriesReportStatusFilter}
                              onChange={(e) => setEntriesReportStatusFilter(e.target.value as typeof entriesReportStatusFilter)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="ALL">All Status</option>
                              <option value="PENDING">Pending</option>
                              <option value="APPROVED">Approved</option>
                              <option value="REJECTED">Rejected</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                            <select
                              value={entriesReportEquipmentFilter}
                              onChange={(e) => setEntriesReportEquipmentFilter(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="ALL">All Equipment</option>
                              {Array.from(new Set((allEntries.data ?? []).map((e) => e.equipmentId))).map((equipmentId) => {
                                const entry = allEntries.data?.find((e) => e.equipmentId === equipmentId);
                                return entry ? (
                                  <option key={equipmentId} value={equipmentId}>
                                    {entry.equipmentNumber} - {entry.equipmentName}
                                  </option>
                                ) : null;
                              })}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                            <input
                              type="date"
                              value={entriesReportDateFrom}
                              onChange={(e) => setEntriesReportDateFrom(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                            <input
                              type="date"
                              value={entriesReportDateTo}
                              onChange={(e) => setEntriesReportDateTo(e.target.value)}
                              min={entriesReportDateFrom || undefined}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                              Showing {(() => {
                                let filtered = (allEntries.data ?? []).filter((e) => {
                                  if (entriesReportSearch) {
                                    const search = entriesReportSearch.toLowerCase();
                                    if (!e.equipmentNumber.toLowerCase().includes(search) && !e.equipmentName.toLowerCase().includes(search)) {
                                      return false;
                                    }
                                  }
                                  return true;
                                });
                                return filtered.length;
                              })()} of {allEntries.data?.length ?? 0} entries
                            </span>
                            {(entriesReportSearch || entriesReportStatusFilter !== "ALL" || entriesReportEquipmentFilter !== "ALL" || entriesReportDateFrom || entriesReportDateTo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEntriesReportSearch("");
                                  setEntriesReportStatusFilter("ALL");
                                  setEntriesReportEquipmentFilter("ALL");
                                  setEntriesReportDateFrom("");
                                  setEntriesReportDateTo("");
                                }}
                                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {(() => {
                          let filtered = (allEntries.data ?? []).filter((e) => {
                            if (entriesReportSearch) {
                              const search = entriesReportSearch.toLowerCase();
                              if (!e.equipmentNumber.toLowerCase().includes(search) && !e.equipmentName.toLowerCase().includes(search)) {
                                return false;
                              }
                            }
                            return true;
                          });

                          return filtered.length === 0 ? (
                            <div className="py-12 text-center">
                              <p className="text-sm font-medium text-[var(--color-text-soft)]">No entries found</p>
                              <p className="text-xs text-[var(--color-text-soft)] mt-1">Try adjusting your filters</p>
                            </div>
                          ) : (
                            filtered.map((entry) => {
                              const statusColors = {
                                PENDING: "bg-yellow-100 text-yellow-800 border-yellow-300",
                                APPROVED: "bg-green-100 text-green-800 border-green-300",
                                REJECTED: "bg-red-100 text-red-800 border-red-300",
                              };
                              return (
                                <div
                                  key={entry.id}
                                  className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md hover:shadow-lg transition-all"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <p className="text-base font-bold text-[var(--color-text)]">{entry.equipmentNumber}</p>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[entry.status as keyof typeof statusColors]}`}>
                                          {entry.status}
                                        </span>
                                        <span className="text-xs font-medium text-[var(--color-text-soft)]">{entry.equipmentName}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">Entry Date</p>
                                          <p className="font-bold text-[var(--color-text)]">{formatDate(entry.entryDate)}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">
                                            {entry.usageUnit === "KM" ? "Kilometers" : "Hours Run"}
                                          </p>
                                          <p className="font-bold text-[var(--color-text)]">{entry.hoursRun.toFixed(2)}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">Created By</p>
                                          <p className="font-bold text-[var(--color-text)]">{entry.createdBy}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">Created At</p>
                                          <p className="font-bold text-[var(--color-text)]">{formatDate(entry.createdAt)}</p>
                                        </div>
                                        {entry.approvedBy && (
                                          <>
                                            <div>
                                              <p className="font-semibold text-[var(--color-text-soft)]">Approved By</p>
                                              <p className="font-bold text-[var(--color-text)]">{entry.approvedBy}</p>
                                            </div>
                                            <div>
                                              <p className="font-semibold text-[var(--color-text-soft)]">Approved At</p>
                                              <p className="font-bold text-[var(--color-text)]">{entry.approvedAt ? formatDate(entry.approvedAt) : "N/A"}</p>
                                            </div>
                                          </>
                                        )}
                                        {entry.rejectedBy && (
                                          <>
                                            <div>
                                              <p className="font-semibold text-[var(--color-text-soft)]">Rejected By</p>
                                              <p className="font-bold text-[var(--color-text)]">{entry.rejectedBy}</p>
                                            </div>
                                            <div>
                                              <p className="font-semibold text-[var(--color-text-soft)]">Rejected At</p>
                                              <p className="font-bold text-[var(--color-text)]">{entry.rejectedAt ? formatDate(entry.rejectedAt) : "N/A"}</p>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingEntryId(entry.id);
                                          setEditEntryDate(entry.entryDate.slice(0, 10));
                                          setEditEntryHours(String(entry.hoursRun));
                                        }}
                                        className="rounded-lg border-2 border-[var(--color-primary)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
                                      >
                                        Edit
                                      </button>
                                      {entry.status === "PENDING" && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              approveEntry.mutate(entry.id, {
                                                onSuccess: () => {
                                                  toast.success("Entry approved successfully");
                                                },
                                                onError: (error) => {
                                                  toast.error(error instanceof Error ? error.message : "Failed to approve entry");
                                                },
                                              });
                                            }}
                                            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              rejectEntry.mutate({ entryId: entry.id }, {
                                                onSuccess: () => {
                                                  toast.success("Entry rejected");
                                                },
                                                onError: (error) => {
                                                  toast.error(error instanceof Error ? error.message : "Failed to reject entry");
                                                },
                                              });
                                            }}
                                            className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDeleteConfirmModal({
                                            type: "entry",
                                            id: entry.id,
                                            name: `Entry for ${entry.equipmentNumber} on ${formatDate(entry.entryDate)}`,
                                            onConfirm: () => {
                                              deleteEntry.mutate(entry.id, {
                                                onSuccess: () => {
                                                  toast.success("Entry deleted successfully");
                                                  setDeleteConfirmModal(null);
                                                },
                                                onError: (error) => {
                                                  toast.error(error instanceof Error ? error.message : "Failed to delete entry");
                                                  setDeleteConfirmModal(null);
                                                },
                                              });
                                            },
                                          });
                                        }}
                                        className="rounded-lg border-2 border-red-500 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          );
                        })()}
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card title="Entries Report">
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Admin access required</p>
                </Card>
              )}
            </div>
          )}

          {activeSection === "planning" && (
            <div className="space-y-6">
              <Card title="Maintenance Planning Calendar">
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Equipment</label>
                    <select
                      value={selectedEquipmentId ?? ""}
                      onChange={(e) => {
                        setSelectedEquipmentId(e.target.value || null);
                        setCurrentMonth(new Date().getMonth());
                        setCurrentWeek(new Date());
                        setCurrentDay(new Date());
                      }}
                      className={inputClass}
                    >
                      <option value="">Select equipment</option>
                      {equipmentOptions.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.equipmentNumber} - {eq.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Year</label>
                    <select
                      value={String(year)}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        setYear(newYear);
                        setCurrentMonth(new Date().getMonth());
                        setCurrentWeek(new Date(newYear, new Date().getMonth(), new Date().getDate()));
                        setCurrentDay(new Date(newYear, new Date().getMonth(), new Date().getDate()));
                      }}
                      className={inputClass}
                    >
                      {yearOptions.map((value) => (
                        <option key={value} value={String(value)}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">View</label>
                    <select
                      value={calendarView}
                      onChange={(e) => setCalendarView(e.target.value as "monthly" | "weekly" | "daily" | "yearly")}
                      className={inputClass}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                {selectedEquipmentId ? (
                  <div className="space-y-4">
                    {calendarView === "monthly" && (
                      <MonthlyCalendar
                        year={year}
                        month={currentMonth}
                        onMonthChange={setCurrentMonth}
                        onYearChange={setYear}
                        planData={plan.data ?? []}
                        onDateClick={(date) => {
                          setCurrentDay(date);
                          setCalendarView("daily");
                        }}
                      />
                    )}
                    {calendarView === "weekly" && (
                      <WeeklyCalendar
                        weekStart={currentWeek}
                        onWeekChange={setCurrentWeek}
                        planData={plan.data ?? []}
                        onDateClick={(date) => {
                          setCurrentDay(date);
                          setCalendarView("daily");
                        }}
                      />
                    )}
                    {calendarView === "daily" && (
                      <DailyCalendar
                        date={currentDay}
                        onDateChange={setCurrentDay}
                        planData={plan.data ?? []}
                      />
                    )}
                    {calendarView === "yearly" && (
                      <YearlyCalendar
                        year={year}
                        onYearChange={setYear}
                        planData={plan.data ?? []}
                        onWeekClick={(week, date) => {
                          setCurrentWeek(date);
                          setCalendarView("weekly");
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-soft)]">Please select an equipment to view the planning calendar</p>
                  </div>
                )}
              </Card>

              {selectedEquipmentId && forecastMetrics.data && (
                <Card title="Forecast Metrics">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border-2 border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/10 to-white p-4 shadow-md">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">Forecast Avg</p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                        {forecastMetrics.data.forecastAverageHoursPerDay.toFixed(2)}h
                      </p>
                    </div>
                    <div className="rounded-xl border-2 border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/10 to-white p-4 shadow-md">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)]">Confidence Range</p>
                      <p className="mt-2 text-sm font-bold text-[var(--color-text)]">
                        {forecastMetrics.data.confidenceLowHoursPerDay.toFixed(2)} - {forecastMetrics.data.confidenceHighHoursPerDay.toFixed(2)}h
                      </p>
                    </div>
                    <div className="rounded-xl border-2 border-[var(--color-accent)]/20 bg-gradient-to-br from-[var(--color-accent)]/10 to-white p-4 shadow-md">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-accent)]">MAPE</p>
                      <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">
                        {forecastMetrics.data.meanAbsolutePercentageError.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeSection === "checks" && (
            <Card title="Upcoming Checks">
              {checksheets.isLoading ? (
                <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
                  Loading checksheets...
                </div>
              ) : checksheets.data && checksheets.data.length > 0 ? (
                <>
                  {(() => {
                    const allChecks = checksheets.data ?? [];
                    const filteredChecks = allChecks.filter((sheet) => {
                      // Upcoming view should not show ongoing (ISSUED) or completed checks
                      if (sheet.status === "ISSUED" || sheet.status === "COMPLETED") {
                        return false;
                      }
                      if (checkFilter !== "ALL" && sheet.status !== checkFilter) {
                        return false;
                      }
                      if (checkEquipmentSearch) {
                        const search = checkEquipmentSearch.toLowerCase();
                        if (
                          !sheet.equipmentNumber.toLowerCase().includes(search) &&
                          !sheet.equipmentName.toLowerCase().includes(search)
                        ) {
                          return false;
                        }
                      }
                      if (checkCodeFilter) {
                        if (sheet.checkCode.toUpperCase() !== checkCodeFilter.toUpperCase()) {
                          return false;
                        }
                      }
                      if (checkTriggerTypeFilter !== "ALL" && sheet.triggerType !== checkTriggerTypeFilter) {
                        return false;
                      }
                      if (checkDateFrom) {
                        const from = new Date(checkDateFrom);
                        if (new Date(sheet.dueDate) < from) {
                          return false;
                        }
                      }
                      if (checkDateTo) {
                        const to = new Date(checkDateTo);
                        to.setHours(23, 59, 59, 999);
                        if (new Date(sheet.dueDate) > to) {
                          return false;
                        }
                      }
                      return true;
                    });

                    const allCodes = Array.from(new Set(allChecks.map((c) => c.checkCode).sort()));

                    return (
                      <>
                        <div className="mb-4 space-y-4">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                              <select
                                value={checkFilter}
                                onChange={(e) => setCheckFilter(e.target.value as typeof checkFilter)}
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              >
                                <option value="ALL">All Status</option>
                                <option value="PREDICTED">Scheduled</option>
                                <option value="ISSUE_REQUIRED">Action Required</option>
                                <option value="NEAR_DUE">Critical</option>
                                <option value="OVERDUE">Overdue</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                              <input
                                type="text"
                                value={checkEquipmentSearch}
                                onChange={(e) => setCheckEquipmentSearch(e.target.value)}
                                placeholder="Search equipment..."
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                              <select
                                value={checkCodeFilter}
                                onChange={(e) => setCheckCodeFilter(e.target.value)}
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              >
                                <option value="">All Codes</option>
                                {allCodes.map((code) => (
                                  <option key={code} value={code}>
                                    Check {code}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Trigger Type</label>
                              <select
                                value={checkTriggerTypeFilter}
                                onChange={(e) => setCheckTriggerTypeFilter(e.target.value as typeof checkTriggerTypeFilter)}
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              >
                                <option value="ALL">All Types</option>
                                <option value="HOURS">Hours-based</option>
                                <option value="CALENDAR">Calendar-based</option>
                              </select>
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                              <input
                                type="date"
                                value={checkDateFrom}
                                onChange={(e) => setCheckDateFrom(e.target.value)}
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                              <input
                                type="date"
                                value={checkDateTo}
                                onChange={(e) => setCheckDateTo(e.target.value)}
                                min={checkDateFrom || undefined}
                                className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                                Showing {filteredChecks.length} of {allChecks.length} checks
                              </span>
                              {(checkDateFrom ||
                                checkDateTo ||
                                checkEquipmentSearch ||
                                checkCodeFilter ||
                                checkTriggerTypeFilter !== "ALL" ||
                                checkFilter !== "ALL") && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCheckFilter("ALL");
                                    setCheckDateFrom("");
                                    setCheckDateTo("");
                                    setCheckEquipmentSearch("");
                                    setCheckCodeFilter("");
                                    setCheckTriggerTypeFilter("ALL");
                                  }}
                                  className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                                >
                                  Clear Filters
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 max-h-[600px] overflow-y-auto">
                          {filteredChecks.map((sheet) => {
                            const colors = getStatusColor(sheet.status);
                            const daysUntilDue = Math.ceil(
                              (new Date(sheet.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                            );
                            return (
                              <div
                                key={sheet.id}
                                className={`group rounded-xl border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-5 shadow-md transition-all hover:shadow-xl`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.badge} whitespace-nowrap`}>
                                        {daysUntilDue > 0
                                          ? `${daysUntilDue} days`
                                          : daysUntilDue === 0
                                          ? "Due today"
                                          : `${Math.abs(daysUntilDue)} days overdue`}
                                      </span>
                                      <p className={`text-sm font-bold ${colors.text}`}>{sheet.equipmentNumber}</p>
                                      <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                                        Check {sheet.checkCode}
                                      </span>
                                      <span
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap ${colors.badge}`}
                                      >
                                        {getStatusLabel(sheet.status)}
                                      </span>
                                    </div>
                                    <div className="space-y-1">
                                      <p className={`text-xs font-medium ${colors.text}`}>
                                        Due Date: {formatDate(sheet.dueDate)} at {sheet.dueHours.toFixed(0)} {sheet.usageUnit === "KM" ? "km" : "hours"}
                                      </p>
                                      <p className={`text-[10px] font-medium ${colors.text} opacity-70`}>
                                        {sheet.triggerType === "HOURS" ? "Hours-based trigger" : "Calendar-based trigger"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    {sheet.status !== "ISSUED" && sheet.status !== "COMPLETED" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIssueModalCheck(sheet);
                                          setIssueDate(new Date().toISOString().slice(0, 10));
                                        }}
                                        className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                      >
                                        Issue Check
                                      </button>
                                    )}
                                    {sheet.status === "ISSUED" && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCompleteModalCheck(sheet);
                                          setCompleteDate(new Date().toISOString().slice(0, 10));
                                        }}
                                        className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                      >
                                        Mark Complete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {filteredChecks.length === 0 && (
                            <div className="py-12 text-center">
                              <p className="text-sm font-medium text-[var(--color-text-soft)]">No maintenance checks found</p>
                              <p className="text-xs text-[var(--color-text-soft)] mt-1">All maintenance checks are up to date</p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-[var(--color-text-soft)]">No maintenance checks found</p>
                  <p className="text-xs text-[var(--color-text-soft)] mt-1">All maintenance checks are up to date</p>
                </div>
              )}
            </Card>
          )}

          {activeSection === "ongoing-checks" && (
            <Card title="Ongoing Checks">
              {checksheets.isLoading ? (
                <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
                  Loading ongoing checks...
                </div>
              ) : checksheets.data && checksheets.data.length > 0 ? (
                (() => {
                  const ongoing = (checksheets.data ?? []).filter((sheet) => sheet.status === "ISSUED");
                  const filtered = ongoing.filter((sheet) => {
                    if (checkEquipmentSearch) {
                      const search = checkEquipmentSearch.toLowerCase();
                      if (
                        !sheet.equipmentNumber.toLowerCase().includes(search) &&
                        !sheet.equipmentName.toLowerCase().includes(search)
                      ) {
                        return false;
                      }
                    }
                    if (checkCodeFilter) {
                      if (sheet.checkCode.toUpperCase() !== checkCodeFilter.toUpperCase()) {
                        return false;
                      }
                    }
                    if (checkDateFrom) {
                      const from = new Date(checkDateFrom);
                      if (new Date(sheet.dueDate) < from) {
                        return false;
                      }
                    }
                    if (checkDateTo) {
                      const to = new Date(checkDateTo);
                      to.setHours(23, 59, 59, 999);
                      if (new Date(sheet.dueDate) > to) {
                        return false;
                      }
                    }
                    return true;
                  });

                  const codes = Array.from(new Set(ongoing.map((c) => c.checkCode).sort()));

                  return (
                    <>
                      <div className="mb-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                            <input
                              type="text"
                              value={checkEquipmentSearch}
                              onChange={(e) => setCheckEquipmentSearch(e.target.value)}
                              placeholder="Search equipment..."
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                            <select
                              value={checkCodeFilter}
                              onChange={(e) => setCheckCodeFilter(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="">All Codes</option>
                              {codes.map((code) => (
                                <option key={code} value={code}>
                                  Check {code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                            <input
                              type="date"
                              value={checkDateFrom}
                              onChange={(e) => setCheckDateFrom(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                            <input
                              type="date"
                              value={checkDateTo}
                              onChange={(e) => setCheckDateTo(e.target.value)}
                              min={checkDateFrom || undefined}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                              Showing {filtered.length} of {ongoing.length} ongoing checks
                            </span>
                            {(checkDateFrom || checkDateTo || checkEquipmentSearch || checkCodeFilter) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckDateFrom("");
                                  setCheckDateTo("");
                                  setCheckEquipmentSearch("");
                                  setCheckCodeFilter("");
                                }}
                                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {filtered.map((sheet) => {
                          const colors = getStatusColor(sheet.status);
                          return (
                            <div
                              key={sheet.id}
                              className={`group rounded-xl border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-5 shadow-md transition-all hover:shadow-xl`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <p className={`text-sm font-bold ${colors.text}`}>{sheet.equipmentNumber}</p>
                                    <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                                      Check {sheet.checkCode}
                                    </span>
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap ${colors.badge}`}
                                    >
                                      Ongoing
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    <p className={`text-xs font-medium ${colors.text}`}>
                                      Due Date: {formatDate(sheet.dueDate)} at {sheet.dueHours.toFixed(0)} {sheet.usageUnit === "KM" ? "km" : "hours"}
                                    </p>
                                    <p className={`text-[10px] font-medium ${colors.text} opacity-70`}>
                                      {sheet.triggerType === "HOURS" ? "Hours-based trigger" : "Calendar-based trigger"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCompleteModalCheck(sheet);
                                      setCompleteDate(new Date().toISOString().slice(0, 10));
                                    }}
                                    className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                  >
                                    Submit Completion
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filtered.length === 0 && (
                          <div className="py-12 text-center">
                            <p className="text-sm font-medium text-[var(--color-text-soft)]">No ongoing checks found</p>
                            <p className="text-xs text-[var(--color-text-soft)] mt-1">All checks are either pending or completed</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-[var(--color-text-soft)]">No ongoing checks found</p>
                  <p className="text-xs text-[var(--color-text-soft)] mt-1">All checks are either pending or completed</p>
                </div>
              )}
            </Card>
          )}

          {activeSection === "completed-checks" && (
            <Card title="Completed Checks">
              {checksheets.isLoading ? (
                <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
                  Loading completed checks...
                </div>
              ) : checksheets.data && checksheets.data.length > 0 ? (
                (() => {
                  const completed = (checksheets.data ?? []).filter((sheet) => sheet.status === "COMPLETED");
                  const filtered = completed.filter((sheet) => {
                    if (checkEquipmentSearch) {
                      const search = checkEquipmentSearch.toLowerCase();
                      if (
                        !sheet.equipmentNumber.toLowerCase().includes(search) &&
                        !sheet.equipmentName.toLowerCase().includes(search)
                      ) {
                        return false;
                      }
                    }
                    if (checkCodeFilter) {
                      if (sheet.checkCode.toUpperCase() !== checkCodeFilter.toUpperCase()) {
                        return false;
                      }
                    }
                    if (checkDateFrom) {
                      const from = new Date(checkDateFrom);
                      if (new Date(sheet.dueDate) < from) {
                        return false;
                      }
                    }
                    if (checkDateTo) {
                      const to = new Date(checkDateTo);
                      to.setHours(23, 59, 59, 999);
                      if (new Date(sheet.dueDate) > to) {
                        return false;
                      }
                    }
                    return true;
                  });

                  const codes = Array.from(new Set(completed.map((c) => c.checkCode).sort()));

                  return (
                    <>
                      <div className="mb-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                            <input
                              type="text"
                              value={checkEquipmentSearch}
                              onChange={(e) => setCheckEquipmentSearch(e.target.value)}
                              placeholder="Search equipment..."
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                            <select
                              value={checkCodeFilter}
                              onChange={(e) => setCheckCodeFilter(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="">All Codes</option>
                              {codes.map((code) => (
                                <option key={code} value={code}>
                                  Check {code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                            <input
                              type="date"
                              value={checkDateFrom}
                              onChange={(e) => setCheckDateFrom(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                            <input
                              type="date"
                              value={checkDateTo}
                              onChange={(e) => setCheckDateTo(e.target.value)}
                              min={checkDateFrom || undefined}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                              Showing {filtered.length} of {completed.length} completed checks
                            </span>
                            {(checkDateFrom || checkDateTo || checkEquipmentSearch || checkCodeFilter) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckDateFrom("");
                                  setCheckDateTo("");
                                  setCheckEquipmentSearch("");
                                  setCheckCodeFilter("");
                                }}
                                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {filtered.map((sheet) => {
                          const colors = getStatusColor(sheet.status);
                          return (
                            <div
                              key={sheet.id}
                              className={`group rounded-xl border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-5 shadow-md transition-all hover:shadow-xl`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <p className={`text-sm font-bold ${colors.text}`}>{sheet.equipmentNumber}</p>
                                    <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                                      Check {sheet.checkCode}
                                    </span>
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap ${colors.badge}`}
                                    >
                                      Completed
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    <p className={`text-xs font-medium ${colors.text}`}>
                                      Due Date: {formatDate(sheet.dueDate)} at {sheet.dueHours.toFixed(0)} {sheet.usageUnit === "KM" ? "km" : "hours"}
                                    </p>
                                    <p className={`text-[10px] font-medium ${colors.text} opacity-70`}>
                                      {sheet.triggerType === "HOURS" ? "Hours-based trigger" : "Calendar-based trigger"}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (typeof window !== "undefined") {
                                          window.open(
                                            apiPath(`/api/checksheets/${sheet.id}/completed-file`),
                                            "_blank",
                                            "noopener,noreferrer",
                                          );
                                        }
                                      }}
                                      className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text)] shadow-sm transition-all hover:bg-white hover:shadow-md"
                                    >
                                      Preview Reference
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowCompletedPdfUploadModal(sheet.id)}
                                      className="rounded-lg bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text)] shadow-sm transition-all hover:bg-white hover:shadow-md"
                                    >
                                      Upload / Replace
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        deleteCompletedCheckPdf.mutate(sheet.id, {
                                          onSuccess: () => {
                                            toast.success("Reference document deleted");
                                          },
                                          onError: (error) => {
                                            toast.error(
                                              error instanceof Error
                                                ? error.message
                                                : "Failed to delete reference document",
                                            );
                                          },
                                        });
                                      }}
                                      className="rounded-lg border border-red-500 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-600 shadow-sm transition-all hover:bg-red-500 hover:text-white"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {filtered.length === 0 && (
                          <div className="py-12 text-center">
                            <p className="text-sm font-medium text-[var(--color-text-soft)]">No completed checks found</p>
                            <p className="text-xs text-[var(--color-text-soft)] mt-1">
                              Try adjusting your filters or date range
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-[var(--color-text-soft)]">No completed checks found</p>
                  <p className="text-xs text-[var(--color-text-soft)] mt-1">
                    Completed checks will appear here after they are recorded.
                  </p>
                </div>
              )}
            </Card>
          )}

          {activeSection === "all-checks" && (
            <Card title="All Checks">
              {allCheckSheets.isLoading ? (
                <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
                  Loading checks...
                </div>
              ) : (
                <>
                  <div className="mb-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Search</label>
                        <input
                          type="text"
                          value={checkSheetMgmtSearch}
                          onChange={(e) => setCheckSheetMgmtSearch(e.target.value)}
                          placeholder="Equipment, check code..."
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                        <select
                          value={checkSheetMgmtStatusFilter}
                          onChange={(e) =>
                            setCheckSheetMgmtStatusFilter(e.target.value as typeof checkSheetMgmtStatusFilter)
                          }
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="ALL">All (Ongoing + Completed)</option>
                          <option value="ISSUED">Ongoing</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                        <select
                          value={checkSheetMgmtEquipmentFilter}
                          onChange={(e) => setCheckSheetMgmtEquipmentFilter(e.target.value)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="ALL">All Equipment</option>
                          {Array.from(new Set((checksheets.data ?? []).filter(s => s.status === "ISSUED" || s.status === "COMPLETED").map((s) => s.equipmentNumber).sort())).map(
                            (num) => (
                              <option key={num} value={num}>
                                {num}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                        <select
                          value={checkSheetMgmtCodeFilter}
                          onChange={(e) => setCheckSheetMgmtCodeFilter(e.target.value)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="ALL">All Codes</option>
                          {Array.from(new Set((checksheets.data ?? []).filter(s => s.status === "ISSUED" || s.status === "COMPLETED").map((s) => s.checkCode).sort())).map(
                            (code) => (
                              <option key={code} value={code}>
                                Check {code}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                        <input
                          type="date"
                          value={checkSheetMgmtDateFrom}
                          onChange={(e) => setCheckSheetMgmtDateFrom(e.target.value)}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                        <input
                          type="date"
                          value={checkSheetMgmtDateTo}
                          onChange={(e) => setCheckSheetMgmtDateTo(e.target.value)}
                          min={checkSheetMgmtDateFrom || undefined}
                          className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                          Showing {filteredAllChecks.length} of {(checksheets.data ?? []).filter(s => s.status === "ISSUED" || s.status === "COMPLETED").length} ongoing/completed checks
                        </span>
                        {(checkSheetMgmtSearch ||
                          checkSheetMgmtStatusFilter !== "ALL" ||
                          checkSheetMgmtEquipmentFilter !== "ALL" ||
                          checkSheetMgmtCodeFilter !== "ALL" ||
                          checkSheetMgmtDateFrom ||
                          checkSheetMgmtDateTo) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckSheetMgmtSearch("");
                              setCheckSheetMgmtStatusFilter("ALL");
                              setCheckSheetMgmtEquipmentFilter("ALL");
                              setCheckSheetMgmtCodeFilter("ALL");
                              setCheckSheetMgmtDateFrom("");
                              setCheckSheetMgmtDateTo("");
                            }}
                            className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                          >
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  {filteredAllChecks.length > 0 ? (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredAllChecks.map((sheet) => {
                      const hasCompletedAt = sheet.completedAt !== null && sheet.completedAt !== undefined && sheet.completedAt !== "";
                      const hasIssuedAt = sheet.issuedAt !== null && sheet.issuedAt !== undefined && sheet.issuedAt !== "";
                      
                      // Priority: completedAt > issuedAt > status
                      let effectiveStatus: string;
                      if (hasCompletedAt) {
                        effectiveStatus = "COMPLETED";
                      } else if (hasIssuedAt && !hasCompletedAt) {
                        effectiveStatus = "ISSUED";
                      } else {
                        effectiveStatus = sheet.status;
                      }
                      
                      const colors = getStatusColor(effectiveStatus);
                      return (
                        <button
                          key={sheet.id}
                          type="button"
                          onClick={() => setSelectedAllChecksSheet(sheet)}
                          className={`w-full text-left rounded-xl border-2 bg-gradient-to-br ${colors.bg} ${colors.border} ${colors.text} p-5 shadow-md transition-all hover:shadow-xl hover:scale-[1.01]`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <p className={`text-sm font-bold ${colors.text}`}>{sheet.equipmentNumber}</p>
                                <span className="px-2 py-0.5 rounded-full bg-white/50 text-[10px] font-bold">
                                  Check {sheet.checkCode}
                                </span>
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase whitespace-nowrap ${colors.badge}`}
                                >
                                  {getStatusLabel(effectiveStatus)}
                                </span>
                              </div>
                              <p className={`text-xs font-medium mb-1 ${colors.text}`}>{sheet.equipmentName}</p>
                              <div className="grid grid-cols-2 gap-3 text-[11px]">
                                <div>
                                  <p className="font-semibold opacity-80">Scheduled Date</p>
                                  <p className="font-bold">{formatDate(sheet.dueDate)}</p>
                                </div>
                                <div>
                                  <p className="font-semibold opacity-80">Scheduled Hours</p>
                                  <p className="font-bold">{sheet.dueHours.toFixed(0)}</p>
                                </div>
                                {sheet.completedAt && (
                                  <>
                                    <div>
                                      <p className="font-semibold opacity-80">Completed Date</p>
                                      <p className="font-bold">{formatDate(sheet.completedAt)}</p>
                                    </div>
                                    <div>
                                      <p className="font-semibold opacity-80">Completed Hours</p>
                                      <p className="font-bold">
                                        {sheet.completedHours !== null ? sheet.completedHours.toFixed(2) : "-"}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center">
                              <span className="text-[11px] font-semibold opacity-80">View details →</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-sm font-medium text-[var(--color-text-soft)]">No ongoing or completed checks found</p>
                      <p className="text-xs text-[var(--color-text-soft)] mt-1">
                        {(() => {
                          const total = checksheets.data?.length ?? 0;
                          if (total > 0) {
                            const issued = checksheets.data?.filter(s => s.status === "ISSUED").length ?? 0;
                            const completed = checksheets.data?.filter(s => s.status === "COMPLETED").length ?? 0;
                            return `Found ${total} total checks. ${issued} are ongoing (ISSUED), ${completed} are completed (COMPLETED).`;
                          }
                          return "No checks available. Issue or complete some checks to see them here.";
                        })()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          {activeSection === "equipment-history" && (
            <div className="space-y-6">
              <Card title="Equipment History">
                <div className="mb-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                        Equipment
                      </label>
                      <select
                        value={historyEquipmentId ?? ""}
                        onChange={(e) => setHistoryEquipmentId(e.target.value || null)}
                        className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="">Select equipment</option>
                        {(equipments.data ?? []).map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.equipmentNumber} - {eq.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                        From
                      </label>
                      <input
                        type="date"
                        value={historyDateFrom}
                        onChange={(e) => setHistoryDateFrom(e.target.value)}
                        className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                        To
                      </label>
                      <input
                        type="date"
                        value={historyDateTo}
                        onChange={(e) => setHistoryDateTo(e.target.value)}
                        min={historyDateFrom || undefined}
                        className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                        Check Status
                      </label>
                      <select
                        value={historyStatusFilter}
                        onChange={(e) =>
                          setHistoryStatusFilter(e.target.value as typeof historyStatusFilter)
                        }
                        className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="ALL">All</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="MISSED">Missed</option>
                        <option value="OVERDUE">Overdue</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                        Check Code
                      </label>
                      <select
                        value={historyCheckCodeFilter}
                        onChange={(e) => setHistoryCheckCodeFilter(e.target.value)}
                        className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="ALL">All</option>
                        {Array.from(
                          new Set(
                            (history.data?.checks ?? []).map((c) => c.checkCode),
                          ),
                        ).map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                      {history.data
                        ? `Showing ${history.data.entries.length} entries, ${history.data.checks.length} checks`
                        : "No data loaded"}
                    </span>
                    <button
                      type="button"
                      onClick={handleExportHistory}
                      disabled={!history.data}
                      className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Export History (CSV)
                    </button>
                  </div>
                </div>
                {historyEquipmentId === null ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-soft)]">
                      Select an equipment to view its full history.
                    </p>
                  </div>
                ) : history.isLoading ? (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-soft)]">
                      Loading history...
                    </p>
                  </div>
                ) : history.data ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">
                          Total Approved Entries
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text)]">
                          {history.data.entries.length}
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">
                          Completed Checks
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text)]">
                          {history.data.checks.filter((c) => c.status === "COMPLETED").length}
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">
                          Missed Checks
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text)]">
                          {history.data.checks.filter((c) => c.isMissed).length}
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-xs font-semibold text-[var(--color-text-soft)] mb-1">
                          Grounded Periods
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text)]">
                          {history.data.groundingPeriods.length}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-sm font-bold text-[var(--color-text)] mb-3">
                          Usage Over Time ({history.data.equipment.usageUnit === "KM" ? "km" : "hours"})
                        </p>
                        {history.data.entries.length === 0 ? (
                          <p className="text-xs text-[var(--color-text-soft)]">
                            No entries available for the selected period.
                          </p>
                        ) : (
                          <svg viewBox="0 0 300 120" className="w-full h-32">
                            {(() => {
                              const values = history.data.entries.map((e) => e.hoursRun);
                              const min = Math.min(...values);
                              const max = Math.max(...values);
                              const span = Math.max(1, max - min);
                              const points = history.data.entries.map((e, index) => {
                                const x = (index / Math.max(1, history.data.entries.length - 1)) * 300;
                                const y =
                                  110 -
                                  ((e.hoursRun - min) / span) * 100;
                                return `${x},${y}`;
                              });
                              return (
                                <>
                                  <line x1="0" y1="110" x2="300" y2="110" stroke="#E5E7EB" strokeWidth="1" />
                                  <line x1="0" y1="10" x2="0" y2="110" stroke="#E5E7EB" strokeWidth="1" />
                                  <polyline
                                    fill="none"
                                    stroke="rgba(59,130,246,0.7)"
                                    strokeWidth="2"
                                    points={points.join(" ")}
                                  />
                                  {points.map((p, idx) => {
                                    const [x, y] = p.split(",").map((v) => Number(v));
                                    return (
                                      <circle
                                        key={idx}
                                        cx={x}
                                        cy={y}
                                        r="2.5"
                                        fill="#3B82F6"
                                      />
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </svg>
                        )}
                      </div>

                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-sm font-bold text-[var(--color-text)] mb-3">
                          Checks Timeline
                        </p>
                        <div className="space-y-3 max-h-40 overflow-y-auto">
                          {(() => {
                            let checks = history.data.checks.filter((c) => c.status !== "PREDICTED");
                            if (historyStatusFilter === "COMPLETED") {
                              checks = checks.filter((c) => c.status === "COMPLETED");
                            } else if (historyStatusFilter === "MISSED") {
                              checks = checks.filter((c) => c.isMissed);
                            } else if (historyStatusFilter === "OVERDUE") {
                              checks = checks.filter((c) => c.status === "OVERDUE");
                            }
                            if (historyCheckCodeFilter !== "ALL") {
                              checks = checks.filter((c) => c.checkCode === historyCheckCodeFilter);
                            }
                            if (checks.length === 0) {
                              return (
                                <p className="text-xs text-[var(--color-text-soft)]">
                                  No checks match the selected filters.
                                </p>
                              );
                            }
                            const total = checks.length;
                            const completedCount = checks.filter((c) => c.status === "COMPLETED").length;
                            const missedCount = checks.filter((c) => c.isMissed).length;
                            const overdueCount = checks.filter((c) => c.status === "OVERDUE").length;
                            return (
                              <>
                                <div className="space-y-1 text-[10px] mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    <span>
                                      Completed: {completedCount} of {total}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    <span>Missed: {missedCount}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <span>Overdue: {overdueCount}</span>
                                  </div>
                                </div>
                                {checks.map((c) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedHistoryCheck(c)}
                                    className="flex w-full items-center justify-between rounded-lg border border-[var(--color-surface-strong)] bg-[var(--color-surface)] px-3 py-2 text-xs text-left hover:bg-[var(--color-surface-strong)] transition-colors"
                                  >
                                    <div>
                                      <p className="font-semibold text-[var(--color-text)]">
                                        Check {c.checkCode} • {c.status}
                                      </p>
                                      <p className="text-[var(--color-text-soft)]">
                                        Due: {formatDate(c.dueDate)} @ {c.dueHours.toFixed(0)}{" "}
                                        {history.data.equipment.usageUnit === "KM" ? "km" : "hours"}
                                      </p>
                                      {c.completedAt && (
                                        <p className="text-[var(--color-text-soft)]">
                                          Completed: {formatDate(c.completedAt)}{" "}
                                          {c.completedHours !== null
                                            ? `@ ${c.completedHours.toFixed(0)} ${
                                                history.data.equipment.usageUnit === "KM"
                                                  ? "km"
                                                  : "hours"
                                              }`
                                            : null}
                                        </p>
                                      )}
                                      {c.isMissed && (
                                        <p className="text-red-600 font-semibold">Marked as missed</p>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-sm font-bold text-[var(--color-text)] mb-3">
                          Entries
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {history.data.entries.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-soft)]">
                              No entries for this equipment in the selected period.
                            </p>
                          ) : (
                            history.data.entries
                              .slice()
                              .reverse()
                              .map((entry) => (
                                <button
                                  type="button"
                                  onClick={() => setSelectedHistoryEntry(entry)}
                                  key={entry.id}
                                  className="w-full text-left rounded-lg border border-[var(--color-surface-strong)] bg-[var(--color-surface)] px-3 py-2 text-xs hover:bg-[var(--color-surface-strong)] transition-colors"
                                >
                                  <p className="font-semibold text-[var(--color-text)]">
                                    {formatDate(entry.entryDate)} •{" "}
                                    {entry.hoursRun.toFixed(2)}{" "}
                                    {history.data.equipment.usageUnit === "KM"
                                      ? "km"
                                      : "hours"}
                                  </p>
                                  <p className="text-[var(--color-text-soft)]">
                                    By {entry.createdBy ?? "Unknown"}
                                    {entry.createdByEmail ? ` (${entry.createdByEmail})` : ""}
                                  </p>
                                  {entry.approvedBy && (
                                    <p className="text-[var(--color-text-soft)]">
                                      Approved by {entry.approvedBy}
                                      {entry.approvedByEmail
                                        ? ` (${entry.approvedByEmail})`
                                        : ""}{" "}
                                      {entry.approvedAt
                                        ? `on ${formatDate(entry.approvedAt)}`
                                        : ""}
                                    </p>
                                  )}
                                </button>
                              ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-white p-4">
                        <p className="text-sm font-bold text-[var(--color-text)] mb-3">
                          Grounding History
                        </p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {history.data.groundingPeriods.length === 0 ? (
                            <p className="text-xs text-[var(--color-text-soft)]">
                              No grounding periods recorded.
                            </p>
                          ) : (
                            history.data.groundingPeriods.map((p) => (
                              <button
                                type="button"
                                onClick={() => setSelectedHistoryGrounding(p)}
                                key={p.id}
                                className="w-full text-left rounded-lg border border-[var(--color-surface-strong)] bg-[var(--color-surface)] px-3 py-2 text-xs hover:bg-[var(--color-surface-strong)] transition-colors"
                              >
                                <p className="font-semibold text-[var(--color-text)]">
                                  {formatDate(p.fromDate)}{" "}
                                  {p.toDate ? `→ ${formatDate(p.toDate)}` : "→ Present"}
                                </p>
                                <p className="text-[var(--color-text-soft)] mt-1">
                                  {p.reason}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-soft)]">
                      No history found for this equipment.
                    </p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "equipment-management" && (
            <div className="space-y-6">
              {canAdmin ? (
                <>
                  <Card title="Equipment Management">
                    <div className="mb-4 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEquipmentCreateModal(true);
                            setEquipmentNumber("");
                            setEquipmentDisplayName("");
                            setAvgHours("8");
                            setCurrentHours("0");
                            setCheckRules([{ code: "A", intervalHours: "500" }]);
                            setPreviousCheckCode("");
                            setPreviousCheckDate("");
                          }}
                          className="rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                        >
                          + Add Equipment
                        </button>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={equipmentMgmtSearch}
                            onChange={(e) => setEquipmentMgmtSearch(e.target.value)}
                            placeholder="Search equipment..."
                            className="h-9 w-64 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          />
                          <select
                            value={equipmentMgmtClassFilter}
                            onChange={(e) => setEquipmentMgmtClassFilter(e.target.value)}
                            className="h-9 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          >
                            <option value="ALL">All Classes</option>
                            {Array.from(new Set((equipments.data ?? []).map((e) => e.equipmentClass).filter(Boolean))).map((cls) => (
                              <option key={cls} value={cls}>{cls}</option>
                            ))}
                          </select>
                          <select
                            value={equipmentMgmtStatusFilter}
                            onChange={(e) => setEquipmentMgmtStatusFilter(e.target.value as typeof equipmentMgmtStatusFilter)}
                            className="h-9 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                          </select>
                          <select
                            value={`${equipmentMgmtSortBy}-${equipmentMgmtSortOrder}`}
                            onChange={(e) => {
                              const [sortBy, sortOrder] = e.target.value.split("-") as [typeof equipmentMgmtSortBy, typeof equipmentMgmtSortOrder];
                              setEquipmentMgmtSortBy(sortBy);
                              setEquipmentMgmtSortOrder(sortOrder);
                            }}
                            className="h-9 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          >
                            <option value="number-asc">Number (A-Z)</option>
                            <option value="number-desc">Number (Z-A)</option>
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="hours-asc">Hours (Low-High)</option>
                            <option value="hours-desc">Hours (High-Low)</option>
                            <option value="avgHours-asc">Avg Hours (Low-High)</option>
                            <option value="avgHours-desc">Avg Hours (High-Low)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {(() => {
                        let filtered = (equipments.data ?? []).filter((eq) => {
                          if (equipmentMgmtSearch) {
                            const search = equipmentMgmtSearch.toLowerCase();
                            if (!eq.equipmentNumber.toLowerCase().includes(search) && !eq.displayName.toLowerCase().includes(search)) {
                              return false;
                            }
                          }
                          if (equipmentMgmtClassFilter !== "ALL" && eq.equipmentClass !== equipmentMgmtClassFilter) {
                            return false;
                          }
                          return true;
                        });
                        filtered.sort((a, b) => {
                          let aVal: any, bVal: any;
                          if (equipmentMgmtSortBy === "number") {
                            aVal = a.equipmentNumber;
                            bVal = b.equipmentNumber;
                          } else if (equipmentMgmtSortBy === "name") {
                            aVal = a.displayName;
                            bVal = b.displayName;
                          } else if (equipmentMgmtSortBy === "hours") {
                            aVal = a.currentHours;
                            bVal = b.currentHours;
                          } else {
                            aVal = a.averageHoursPerDay;
                            bVal = b.averageHoursPerDay;
                          }
                          if (typeof aVal === "string") {
                            return equipmentMgmtSortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                          }
                          return equipmentMgmtSortOrder === "asc" ? aVal - bVal : bVal - aVal;
                        });
                        return filtered.map((eq) => (
                          <div
                            key={eq.id}
                            className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md hover:shadow-lg transition-all"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="text-base font-bold text-[var(--color-text)]">{eq.equipmentNumber}</p>
                                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">{eq.equipmentClass}</span>
                                </div>
                                <p className="text-sm font-medium text-[var(--color-text-soft)] mb-2">{eq.displayName}</p>
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <p className="font-semibold text-[var(--color-text-soft)]">Current Hours</p>
                                    <p className="font-bold text-[var(--color-text)]">{eq.currentHours.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-[var(--color-text-soft)]">Avg Hours/Day</p>
                                    <p className="font-bold text-[var(--color-text)]">{eq.averageHoursPerDay.toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-[var(--color-text-soft)]">Check Rules</p>
                                    <p className="font-bold text-[var(--color-text)]">{eq.activeRuleCount}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2 ml-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEquipmentForMgmt(eq.id);
                                    setShowEquipmentDetailsModal(true);
                                  }}
                                  className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                >
                                  View Details
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEquipmentForMgmt(eq.id);
                                    setShowEquipmentEditModal(true);
                                  }}
                                  className="rounded-lg border-2 border-[var(--color-primary)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
                                >
                                  Edit
                                </button>
                                {eq.hasActiveGrounding ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEquipmentForMgmt(eq.id);
                                      setGroundEndDate(new Date().toISOString().slice(0, 10));
                                      setShowEndGroundingModal(true);
                                    }}
                                    className="rounded-lg border-2 border-green-600 bg-white px-3 py-1.5 text-xs font-bold text-green-700 transition-all hover:bg-green-600 hover:text-white"
                                  >
                                    Unground
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEquipmentForMgmt(eq.id);
                                      setGroundFromDate(new Date().toISOString().slice(0, 10));
                                      setGroundReason("");
                                      setShowGroundEquipmentModal(true);
                                    }}
                                    className="rounded-lg border-2 border-yellow-500 bg-white px-3 py-1.5 text-xs font-bold text-yellow-600 transition-all hover:bg-yellow-500 hover:text-white"
                                  >
                                    Ground
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmModal({
                                      type: "equipment",
                                      id: eq.id,
                                      name: eq.equipmentNumber,
                                      onConfirm: () => {
                                        deleteEquipment.mutate(eq.id, {
                                          onSuccess: () => {
                                            toast.success("Equipment deleted successfully");
                                            setDeleteConfirmModal(null);
                                          },
                                          onError: (error) => {
                                            toast.error(error instanceof Error ? error.message : "Failed to delete equipment");
                                            setDeleteConfirmModal(null);
                                          },
                                        });
                                      },
                                    });
                                  }}
                                  className="rounded-lg border-2 border-red-500 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ));
                      })()}
                      {(() => {
                        const filtered = (equipments.data ?? []).filter((eq) => {
                          if (equipmentMgmtSearch) {
                            const search = equipmentMgmtSearch.toLowerCase();
                            if (!eq.equipmentNumber.toLowerCase().includes(search) && !eq.displayName.toLowerCase().includes(search)) {
                              return false;
                            }
                          }
                          if (equipmentMgmtClassFilter !== "ALL" && eq.equipmentClass !== equipmentMgmtClassFilter) {
                            return false;
                          }
                          return true;
                        });
                        return filtered.length === 0 ? (
                          <div className="py-12 text-center">
                            <p className="text-sm font-medium text-[var(--color-text-soft)]">No equipment found</p>
                            <p className="text-xs text-[var(--color-text-soft)] mt-1">Try adjusting your filters</p>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </Card>

                  {false && (
                    <Card title="Check Sheets Management">
                      <div className="mb-4 space-y-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Search</label>
                            <input
                              type="text"
                              value={checkSheetMgmtSearch}
                              onChange={(e) => setCheckSheetMgmtSearch(e.target.value)}
                              placeholder="Equipment, check code..."
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                            <select
                              value={checkSheetMgmtStatusFilter}
                              onChange={(e) => setCheckSheetMgmtStatusFilter(e.target.value as typeof checkSheetMgmtStatusFilter)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="ALL">All (Ongoing + Completed)</option>
                              <option value="ISSUED">Ongoing</option>
                              <option value="COMPLETED">Completed</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                            <select
                              value={checkSheetMgmtEquipmentFilter}
                              onChange={(e) => setCheckSheetMgmtEquipmentFilter(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="ALL">All Equipment</option>
                              {Array.from(new Set((allCheckSheets.data ?? []).map((s) => s.equipmentNumber).sort())).map((num) => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                            <select
                              value={checkSheetMgmtCodeFilter}
                              onChange={(e) => setCheckSheetMgmtCodeFilter(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            >
                              <option value="ALL">All Codes</option>
                              {Array.from(new Set((allCheckSheets.data ?? []).map((s) => s.checkCode).sort())).map((code) => (
                                <option key={code} value={code}>Check {code}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date From</label>
                            <input
                              type="date"
                              value={checkSheetMgmtDateFrom}
                              onChange={(e) => setCheckSheetMgmtDateFrom(e.target.value)}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Date To</label>
                            <input
                              type="date"
                              value={checkSheetMgmtDateTo}
                              onChange={(e) => setCheckSheetMgmtDateTo(e.target.value)}
                              min={checkSheetMgmtDateFrom || undefined}
                              className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                              Showing {(() => {
                                let filtered = (allCheckSheets.data ?? []).filter((s) => {
                                  if (checkSheetMgmtSearch) {
                                    const search = checkSheetMgmtSearch.toLowerCase();
                                    if (!s.equipmentNumber.toLowerCase().includes(search) && 
                                        !s.equipmentName.toLowerCase().includes(search) &&
                                        !s.checkCode.toLowerCase().includes(search)) {
                                      return false;
                                    }
                                  }
                                  if (checkSheetMgmtStatusFilter !== "ALL" && s.status !== checkSheetMgmtStatusFilter) {
                                    return false;
                                  }
                                  if (checkSheetMgmtEquipmentFilter !== "ALL" && s.equipmentNumber !== checkSheetMgmtEquipmentFilter) {
                                    return false;
                                  }
                                  if (checkSheetMgmtCodeFilter !== "ALL" && s.checkCode !== checkSheetMgmtCodeFilter) {
                                    return false;
                                  }
                                  if (checkSheetMgmtDateFrom) {
                                    const fromDate = new Date(checkSheetMgmtDateFrom);
                                    const dueDate = new Date(s.dueDate);
                                    if (dueDate < fromDate) return false;
                                  }
                                  if (checkSheetMgmtDateTo) {
                                    const toDate = new Date(checkSheetMgmtDateTo);
                                    toDate.setHours(23, 59, 59, 999);
                                    const dueDate = new Date(s.dueDate);
                                    if (dueDate > toDate) return false;
                                  }
                                  return true;
                                });
                                return filtered.length;
                              })()} of {allCheckSheets.data?.length ?? 0} check sheets
                            </span>
                            {(checkSheetMgmtSearch ||
                              checkSheetMgmtStatusFilter !== "ALL" ||
                              checkSheetMgmtEquipmentFilter !== "ALL" ||
                              checkSheetMgmtCodeFilter !== "ALL" ||
                              checkSheetMgmtDateFrom ||
                              checkSheetMgmtDateTo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCheckSheetMgmtSearch("");
                                  setCheckSheetMgmtStatusFilter("ALL");
                                  setCheckSheetMgmtEquipmentFilter("ALL");
                                  setCheckSheetMgmtCodeFilter("ALL");
                                  setCheckSheetMgmtDateFrom("");
                                  setCheckSheetMgmtDateTo("");
                                }}
                                className="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {(() => {
                          let filtered = (allCheckSheets.data ?? []).filter((s) => {
                            if (checkSheetMgmtSearch) {
                              const search = checkSheetMgmtSearch.toLowerCase();
                              if (!s.equipmentNumber.toLowerCase().includes(search) && 
                                  !s.equipmentName.toLowerCase().includes(search) &&
                                  !s.checkCode.toLowerCase().includes(search)) {
                                return false;
                              }
                            }
                            if (checkSheetMgmtStatusFilter !== "ALL" && s.status !== checkSheetMgmtStatusFilter) {
                              return false;
                            }
                            if (checkSheetMgmtEquipmentFilter !== "ALL" && s.equipmentNumber !== checkSheetMgmtEquipmentFilter) {
                              return false;
                            }
                            if (checkSheetMgmtCodeFilter !== "ALL" && s.checkCode !== checkSheetMgmtCodeFilter) {
                              return false;
                            }
                            if (checkSheetMgmtDateFrom) {
                              const fromDate = new Date(checkSheetMgmtDateFrom);
                              const dueDate = new Date(s.dueDate);
                              if (dueDate < fromDate) return false;
                            }
                            if (checkSheetMgmtDateTo) {
                              const toDate = new Date(checkSheetMgmtDateTo);
                              toDate.setHours(23, 59, 59, 999);
                              const dueDate = new Date(s.dueDate);
                              if (dueDate > toDate) return false;
                            }
                            return true;
                          });
                          return filtered.map((sheet) => {
                            const colors = getStatusColor(sheet.status);
                            return (
                              <div
                                key={sheet.id}
                                className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md hover:shadow-lg transition-all"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                      <p className="text-base font-bold text-[var(--color-text)]">{sheet.equipmentNumber}</p>
                                      <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">Check {sheet.checkCode}</span>
                                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${colors.badge}`}>
                                        {getStatusLabel(sheet.status)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-[var(--color-text-soft)] mb-2">{sheet.equipmentName}</p>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                      <div>
                                        <p className="font-semibold text-[var(--color-text-soft)]">Due Date</p>
                                        <p className="font-bold text-[var(--color-text)]">{formatDate(sheet.dueDate)}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-[var(--color-text-soft)]">Due Hours</p>
                                        <p className="font-bold text-[var(--color-text)]">{sheet.dueHours.toFixed(0)}</p>
                                      </div>
                                      <div>
                                        <p className="font-semibold text-[var(--color-text-soft)]">Trigger Type</p>
                                        <p className="font-bold text-[var(--color-text)]">{sheet.triggerType}</p>
                                      </div>
                                      {sheet.issuedAt && (
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">Issued At</p>
                                          <p className="font-bold text-[var(--color-text)]">{formatDate(sheet.issuedAt)}</p>
                                        </div>
                                      )}
                                      {sheet.completedAt && (
                                        <div>
                                          <p className="font-semibold text-[var(--color-text-soft)]">Completed At</p>
                                          <p className="font-bold text-[var(--color-text)]">{formatDate(sheet.completedAt)}</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="font-semibold text-[var(--color-text-soft)]">PDF File</p>
                                        <p className="font-bold text-[var(--color-text)]">
                                          {sheet.pdfFilePath ? (
                                            <span className="text-green-600">✓ Uploaded</span>
                                          ) : (
                                            <span className="text-gray-400">Not uploaded</span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2 ml-4">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedEquipmentForMgmt(sheet.equipmentId);
                                        setEditingCheckSheetId(sheet.id);
                                        setShowCheckSheetModal(true);
                                      }}
                                      className="rounded-lg border-2 border-[var(--color-primary)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
                                    >
                                      Edit
                                    </button>
                                    {sheet.pdfFilePath ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShowPdfPreviewModal(sheet.id);
                                          }}
                                          className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
                                        >
                                          Preview PDF
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setShowPdfUploadModal(sheet.id)}
                                          className="rounded-lg border-2 border-orange-500 bg-white px-3 py-1.5 text-xs font-bold text-orange-500 transition-all hover:bg-orange-500 hover:text-white"
                                        >
                                          Replace PDF
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteConfirmModal({
                                              type: "checkSheet",
                                              id: sheet.id,
                                              name: `PDF file for ${sheet.equipmentNumber} - Check ${sheet.checkCode}`,
                                              onConfirm: () => {
                                                deleteCheckSheetPdf.mutate(sheet.id, {
                                                  onSuccess: () => {
                                                    toast.success("PDF file deleted successfully");
                                                    setDeleteConfirmModal(null);
                                                  },
                                                  onError: (error) => {
                                                    toast.error(error instanceof Error ? error.message : "Failed to delete PDF file");
                                                    setDeleteConfirmModal(null);
                                                  },
                                                });
                                              },
                                            });
                                          }}
                                          className="rounded-lg border-2 border-red-500 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                        >
                                          Delete PDF
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setShowPdfUploadModal(sheet.id)}
                                        className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
                                      >
                                        Upload PDF
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteConfirmModal({
                                          type: "checkSheet",
                                          id: sheet.id,
                                          name: `${sheet.equipmentNumber} - Check ${sheet.checkCode}`,
                                          onConfirm: () => {
                                            deleteCheckSheetDetail.mutate(
                                              { equipmentId: sheet.equipmentId, sheetId: sheet.id },
                                              {
                                                onSuccess: () => {
                                                  toast.success("Check sheet deleted successfully");
                                                  setDeleteConfirmModal(null);
                                                },
                                                onError: (error) => {
                                                  toast.error(error instanceof Error ? error.message : "Failed to delete check sheet");
                                                  setDeleteConfirmModal(null);
                                                },
                                              }
                                            );
                                          },
                                        });
                                      }}
                                      className="rounded-lg border-2 border-red-500 bg-white px-3 py-1.5 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                    >
                                      Delete Sheet
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {(() => {
                          let filtered = (allCheckSheets.data ?? []).filter((s) => {
                            if (checkSheetMgmtSearch) {
                              const search = checkSheetMgmtSearch.toLowerCase();
                              if (!s.equipmentNumber.toLowerCase().includes(search) && 
                                  !s.equipmentName.toLowerCase().includes(search) &&
                                  !s.checkCode.toLowerCase().includes(search)) {
                                return false;
                              }
                            }
                            if (checkSheetMgmtStatusFilter !== "ALL" && s.status !== checkSheetMgmtStatusFilter) {
                              return false;
                            }
                            if (checkSheetMgmtEquipmentFilter !== "ALL" && s.equipmentNumber !== checkSheetMgmtEquipmentFilter) {
                              return false;
                            }
                            if (checkSheetMgmtCodeFilter !== "ALL" && s.checkCode !== checkSheetMgmtCodeFilter) {
                              return false;
                            }
                            if (checkSheetMgmtDateFrom) {
                              const fromDate = new Date(checkSheetMgmtDateFrom);
                              const dueDate = new Date(s.dueDate);
                              if (dueDate < fromDate) return false;
                            }
                            if (checkSheetMgmtDateTo) {
                              const toDate = new Date(checkSheetMgmtDateTo);
                              toDate.setHours(23, 59, 59, 999);
                              const dueDate = new Date(s.dueDate);
                              if (dueDate > toDate) return false;
                            }
                            return true;
                          });
                          return filtered.length === 0 ? (
                            <div className="py-12 text-center">
                              <p className="text-sm font-medium text-[var(--color-text-soft)]">No check sheets found</p>
                              <p className="text-xs text-[var(--color-text-soft)] mt-1">Try adjusting your filters</p>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <Card title="Equipment Management">
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Admin access required</p>
                </Card>
              )}
            </div>
          )}

          {activeSection === "pending-approvals" && (
            <div className="space-y-6">
              {canAdmin ? (
                <Card title="Pending Approvals">
                  {pendingEntries.isLoading ? (
                    <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Loading pending entries...</div>
                  ) : pendingEntries.data && pendingEntries.data.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {pendingEntries.data.length} pending entr{pendingEntries.data.length === 1 ? "y" : "ies"} awaiting approval
                        </p>
                      </div>
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {Object.entries(
                          pendingEntries.data.reduce<Record<string, typeof pendingEntries.data>>((groups, entry) => {
                            const dateKey = entry.entryDate.split("T")[0];
                            if (!groups[dateKey]) groups[dateKey] = [];
                            groups[dateKey].push(entry);
                            return groups;
                          }, {}),
                        )
                          .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
                          .map(([dateKey, entriesForDate]) => (
                            <div key={dateKey} className="rounded-xl border border-[var(--color-surface-strong)] bg-white p-3 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-[var(--color-text)]">
                                    {formatDate(new Date(dateKey))}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-soft)]">
                                    {entriesForDate.length} entr{entriesForDate.length === 1 ? "y" : "ies"} on this day
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!entriesForDate[0]) return;
                                    const entryDateIso = entriesForDate[0].entryDate.split("T")[0];
                                    approveEntriesByDate.mutate(entryDateIso, {
                                      onSuccess: (result) => {
                                        toast.success(`Approved ${result.approvedCount} entr${result.approvedCount === 1 ? "y" : "ies"} for ${formatDate(new Date(entryDateIso))}`);
                                      },
                                      onError: (error) => {
                                        toast.error(error instanceof Error ? error.message : "Failed to approve entries for this day");
                                      },
                                    });
                                  }}
                                  disabled={approveEntriesByDate.isPending}
                                  className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {approveEntriesByDate.isPending ? "Approving..." : "Approve all for this day"}
                                </button>
                              </div>
                              <div className="space-y-3">
                                {entriesForDate.map((entry) => (
                                  <PendingEntryCard
                                    key={entry.id}
                                    entry={entry}
                                    onApprove={(id) => {
                                      approveEntry.mutate(id, {
                                        onSuccess: () => {
                                          toast.success("Entry approved successfully");
                                        },
                                        onError: (error) => {
                                          toast.error(error instanceof Error ? error.message : "Failed to approve entry");
                                        },
                                      });
                                    }}
                                    onReject={(id, reason) => {
                                      rejectEntry.mutate({ entryId: id, reason }, {
                                        onSuccess: () => {
                                          toast.success("Entry rejected");
                                        },
                                        onError: (error) => {
                                          toast.error(error instanceof Error ? error.message : "Failed to reject entry");
                                        },
                                      });
                                    }}
                                    onUpdate={(id, entryDate, hoursRun) => {
                                      updateEntry.mutate({ entryId: id, entryDate, hoursRun }, {
                                        onSuccess: () => {
                                          toast.success("Entry updated successfully");
                                        },
                                        onError: (error) => {
                                          toast.error(error instanceof Error ? error.message : "Failed to update entry");
                                        },
                                      });
                                    }}
                                    onDelete={(id) => {
                                      deleteEntry.mutate(id, {
                                        onSuccess: () => {
                                          toast.success("Entry deleted successfully");
                                        },
                                        onError: (error) => {
                                          toast.error(error instanceof Error ? error.message : "Failed to delete entry");
                                        },
                                      });
                                    }}
                                    isApproving={approveEntry.isPending}
                                    isRejecting={rejectEntry.isPending}
                                    isUpdating={updateEntry.isPending}
                                    isDeleting={deleteEntry.isPending}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="text-sm font-medium text-[var(--color-text-soft)]">No pending entries</p>
                      <p className="text-xs text-[var(--color-text-soft)] mt-1">All entries have been reviewed</p>
                    </div>
                  )}
                </Card>
              ) : (
                <Card title="Pending Approvals">
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Admin access required</p>
                </Card>
              )}
            </div>
          )}

          {issueModalCheck && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIssueModalCheck(null)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-3">Issue Checksheet</h3>
                <p className="text-xs font-medium text-[var(--color-text-soft)] mb-4">
                  Equipment {issueModalCheck.equipmentNumber} • Check {issueModalCheck.checkCode}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Issue Date</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <p className="text-[11px] text-[var(--color-text-soft)]">
                    After issuing, the checksheet PDF for this equipment and check type will open in a new tab for printing.
                  </p>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!issueDate) return;
                        const dateIso = new Date(`${issueDate}T00:00:00.000Z`).toISOString();
                        updateCheckSheet.mutate(
                          { id: issueModalCheck.id, action: "issue", date: dateIso },
                          {
                            onSuccess: () => {
                              toast.success(`Maintenance check ${issueModalCheck.checkCode} issued for equipment ${issueModalCheck.equipmentNumber}`);
                              const safeEquipment = issueModalCheck.equipmentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
                              const safeCode = issueModalCheck.checkCode.toUpperCase();
                              const pdfPath = `${UPLOADS_BASE_URL}/checksheets/${safeEquipment}_${safeCode}.pdf`;
                              if (typeof window !== "undefined") {
                                window.open(pdfPath, "_blank");
                              }
                              setIssueModalCheck(null);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to issue check");
                            },
                          }
                        );
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                    >
                      Confirm & Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setIssueModalCheck(null)}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {completeModalCheck && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setCompleteModalCheck(null)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-3">Record Check Completion</h3>
                <p className="text-xs font-medium text-[var(--color-text-soft)] mb-4">
                  Equipment {completeModalCheck.equipmentNumber} • Check {completeModalCheck.checkCode}
                </p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Completion Date</label>
                      <input
                        type="date"
                        value={completeDate}
                        onChange={(e) => setCompleteDate(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Completed Hours</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={completeHours}
                        onChange={(e) => setCompleteHours(e.target.value)}
                        placeholder="Enter cumulative hours"
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">
                      Completed Checksheet (optional)
                    </label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file || !completeModalCheck) return;
                        uploadCompletedCheckPdf.mutate(
                          { checkSheetId: completeModalCheck.id, file },
                          {
                            onSuccess: () => {
                              toast.success("Completed checksheet uploaded");
                            },
                            onError: (error) => {
                              toast.error(
                                error instanceof Error ? error.message : "Failed to upload completed checksheet"
                              );
                            },
                          },
                        );
                      }}
                      className="block w-full text-xs text-[var(--color-text-soft)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--color-primary-dark)]"
                    />
                    <p className="mt-1 text-[11px] text-[var(--color-text-soft)]">
                      Upload the signed / completed checksheet for reference. This field is optional.
                    </p>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!completeDate) return;
                        const hoursValue = Number(completeHours);
                        if (!Number.isFinite(hoursValue) || hoursValue < 0) {
                          toast.error("Please enter valid completed hours");
                          return;
                        }
                        const dateIso = new Date(`${completeDate}T00:00:00.000Z`).toISOString();
                        updateCheckSheet.mutate(
                          { id: completeModalCheck.id, action: "complete", date: dateIso, completedHours: hoursValue },
                          {
                            onSuccess: () => {
                              toast.success(
                                `Maintenance check ${completeModalCheck.checkCode} completed for equipment ${completeModalCheck.equipmentNumber}`,
                              );
                              setCompleteModalCheck(null);
                              setCompleteHours("");
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to complete check");
                            },
                          },
                        );
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                    >
                      Submit Completion
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompleteModalCheck(null)}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEquipmentCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowEquipmentCreateModal(false)}>
              <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Create New Equipment</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment Number *</label>
                      <input
                        type="text"
                        value={equipmentNumber}
                        onChange={(e) => setEquipmentNumber(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        placeholder="e.g., 1001"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Display Name *</label>
                      <input
                        type="text"
                        value={equipmentDisplayName}
                        onChange={(e) => setEquipmentDisplayName(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        placeholder="Equipment name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Average Hours/Day *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={avgHours}
                        onChange={(e) => setAvgHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Current Hours *</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={currentHours}
                        onChange={(e) => setCurrentHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Usage Unit</label>
                      <select
                        value={createUsageUnit}
                        onChange={(e) => setCreateUsageUnit(e.target.value as "HOURS" | "KM")}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="HOURS">Hours (Hour Meter)</option>
                        <option value="KM">Kilometers</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Check Rules *</label>
                    <div className="space-y-2">
                      {checkRules.map((rule, index) => (
                        <div key={index} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={rule.code}
                            onChange={(e) => updateCheckRule(index, "code", e.target.value)}
                            maxLength={1}
                            className="h-10 w-16 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 text-center"
                            placeholder="A"
                          />
                          <input
                            type="number"
                            step="1"
                            min="1"
                            value={rule.intervalHours}
                            onChange={(e) => updateCheckRule(index, "intervalHours", e.target.value)}
                            className="flex-1 h-10 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                            placeholder="Interval hours"
                          />
                          {checkRules.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeCheckRule(index)}
                              className="h-10 w-10 rounded-lg border-2 border-red-500 bg-white text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addCheckRule}
                        className="w-full rounded-lg border-2 border-dashed border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary)]/10 transition-all"
                      >
                        + Add Check Rule
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Previous Check Code (Optional)</label>
                      <input
                        type="text"
                        value={previousCheckCode}
                        onChange={(e) => setPreviousCheckCode(e.target.value.toUpperCase().slice(0, 1))}
                        maxLength={1}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        placeholder="A"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Previous Check Date (Optional)</label>
                      <input
                        type="date"
                        value={previousCheckDate}
                        onChange={(e) => setPreviousCheckDate(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onCreateEquipment()}
                      disabled={createEquipment.isPending || !equipmentNumber || !avgHours || !currentHours || checkRules.length === 0 || checkRules.some(r => !r.code || !r.intervalHours || Number(r.intervalHours) <= 0)}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createEquipment.isPending ? "Creating..." : "Create Equipment"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEquipmentCreateModal(false);
                        setEquipmentNumber("");
                        setEquipmentDisplayName("");
                        setAvgHours("8");
                        setCurrentHours("0");
                        setCheckRules([{ code: "A", intervalHours: "500" }]);
                        setPreviousCheckCode("");
                        setPreviousCheckDate("");
                      }}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEquipmentEditModal && equipmentDetail.data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowEquipmentEditModal(false)}>
              <div className="relative w-full max-w-2xl rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Edit Equipment</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment Number</label>
                      <input
                        type="text"
                        value={editEquipmentNumber}
                        onChange={(e) => setEditEquipmentNumber(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Display Name</label>
                      <input
                        type="text"
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Usage Unit</label>
                      <select
                        value={editUsageUnit}
                        onChange={(e) => setEditUsageUnit(e.target.value as "HOURS" | "KM")}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="HOURS">Hours (Hour Meter)</option>
                        <option value="KM">Kilometers</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment Class</label>
                      <input
                        type="text"
                        value={editEquipmentClass}
                        onChange={(e) => setEditEquipmentClass(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Commissioned At</label>
                      <input
                        type="date"
                        value={editCommissionedAt}
                        onChange={(e) => setEditCommissionedAt(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Average Hours/Day</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editAvgHours}
                        onChange={(e) => setEditAvgHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Current Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={editCurrentHours}
                        onChange={(e) => setEditCurrentHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                    <select
                      value={editIsActive ? "ACTIVE" : "INACTIVE"}
                      onChange={(e) => setEditIsActive(e.target.value === "ACTIVE")}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateEquipment.mutate(
                          {
                            equipmentId: selectedEquipmentForMgmt!,
                            equipmentNumber: editEquipmentNumber,
                            displayName: editDisplayName,
                            equipmentClass: editEquipmentClass,
                            averageHoursPerDay: Number(editAvgHours),
                            currentHours: Number(editCurrentHours),
                            commissionedAt: editCommissionedAt || null,
                            isActive: editIsActive,
                            usageUnit: editUsageUnit,
                          },
                          {
                            onSuccess: () => {
                              toast.success("Equipment updated successfully");
                              setShowEquipmentEditModal(false);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to update equipment");
                            },
                          }
                        );
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEquipmentEditModal(false)}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {editingEntryId && (() => {
            const entry = allEntries.data?.find((e) => e.id === editingEntryId);
            if (!entry) return null;
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingEntryId(null)}>
                <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Edit Entry</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment</label>
                      <input
                        type="text"
                        value={`${entry.equipmentNumber} - ${entry.equipmentName}`}
                        disabled
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-gray-100 px-3 text-sm font-medium text-[var(--color-text)] opacity-60"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Entry Date *</label>
                      <input
                        type="date"
                        value={editEntryDate}
                        onChange={(e) => setEditEntryDate(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Hours Run *</label>
                      <input
                        type="number"
                        step="0.01"
                        min={entry.previousHours}
                        value={editEntryHours}
                        onChange={(e) => setEditEntryHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                      {Number(editEntryHours) < entry.previousHours && (
                        <p className="mt-1 text-xs text-red-600">
                          ⚠️ Hours must be at least {entry.previousHours.toFixed(2)} (previous entry hours)
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!editEntryDate || !editEntryHours) {
                            toast.error("Please fill in all required fields");
                            return;
                          }
                          if (Number(editEntryHours) < entry.previousHours) {
                            toast.error(`Hours must be at least ${entry.previousHours.toFixed(2)}`);
                            return;
                          }
                          updateEntry.mutate(
                            {
                              entryId: editingEntryId,
                              entryDate: new Date(`${editEntryDate}T00:00:00.000Z`).toISOString(),
                              hoursRun: Number(editEntryHours),
                            },
                            {
                              onSuccess: () => {
                                toast.success("Entry updated successfully");
                                setEditingEntryId(null);
                              },
                              onError: (error) => {
                                toast.error(error instanceof Error ? error.message : "Failed to update entry");
                              },
                            }
                          );
                        }}
                        disabled={updateEntry.isPending || !editEntryDate || !editEntryHours || Number(editEntryHours) < entry.previousHours}
                        className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {updateEntry.isPending ? "Updating..." : "Update Entry"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEntryId(null)}
                        className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {showCheckRuleModal && selectedEquipmentForMgmt && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCheckRuleModal(false)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">{editingCheckRuleId ? "Edit Check Rule" : "Add Check Rule"}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                    <input
                      type="text"
                      value={checkRuleCode}
                      onChange={(e) => setCheckRuleCode(e.target.value.toUpperCase().slice(0, 1))}
                      maxLength={1}
                      disabled={!!editingCheckRuleId}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Interval Hours</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={checkRuleIntervalHours}
                      onChange={(e) => setCheckRuleIntervalHours(e.target.value)}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Time Interval (optional)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={checkRuleIntervalTimeValue}
                          onChange={(e) => setCheckRuleIntervalTimeValue(e.target.value)}
                          className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                          placeholder="Value"
                        />
                      </div>
                      <div>
                        <select
                          value={checkRuleIntervalTimeUnit}
                          onChange={(e) => setCheckRuleIntervalTimeUnit(e.target.value as "MONTHS" | "YEARS")}
                          className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-2 text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                        >
                          <option value="MONTHS">Months</option>
                          <option value="YEARS">Years</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {editingCheckRuleId && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                      <select
                        value={checkRuleIsActive ? "ACTIVE" : "INACTIVE"}
                        onChange={(e) => setCheckRuleIsActive(e.target.value === "ACTIVE")}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const timeValueNumber = checkRuleIntervalTimeValue ? Number(checkRuleIntervalTimeValue) : undefined;
                        if (editingCheckRuleId) {
                          updateEquipmentCheckRule.mutate(
                            {
                              equipmentId: selectedEquipmentForMgmt,
                              ruleId: editingCheckRuleId,
                              intervalHours: Number(checkRuleIntervalHours),
                              isActive: checkRuleIsActive,
                              intervalTimeValue: timeValueNumber && timeValueNumber > 0 ? timeValueNumber : null,
                              intervalTimeUnit: timeValueNumber && timeValueNumber > 0 ? checkRuleIntervalTimeUnit : null,
                            },
                            {
                              onSuccess: () => {
                                toast.success("Check rule updated successfully");
                                setShowCheckRuleModal(false);
                                setEditingCheckRuleId(null);
                              },
                              onError: (error) => {
                                toast.error(error instanceof Error ? error.message : "Failed to update check rule");
                              },
                            }
                          );
                        } else {
                          createCheckRule.mutate(
                            {
                              equipmentId: selectedEquipmentForMgmt,
                              code: checkRuleCode,
                              intervalHours: Number(checkRuleIntervalHours),
                              intervalTimeValue: checkRuleIntervalTimeValue ? Number(checkRuleIntervalTimeValue) : undefined,
                              intervalTimeUnit: checkRuleIntervalTimeValue ? checkRuleIntervalTimeUnit : undefined,
                            },
                            {
                              onSuccess: () => {
                                toast.success("Check rule created successfully");
                                setShowCheckRuleModal(false);
                                setCheckRuleCode("A");
                                setCheckRuleIntervalHours("500");
                              },
                              onError: (error) => {
                                toast.error(error instanceof Error ? error.message : "Failed to create check rule");
                              },
                            }
                          );
                        }
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                    >
                      {editingCheckRuleId ? "Save Changes" : "Create Rule"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCheckRuleModal(false);
                        setEditingCheckRuleId(null);
                      }}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showGroundEquipmentModal && selectedEquipmentForMgmt && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShowGroundEquipmentModal(false)}
            >
              <div
                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Ground Equipment</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">
                      Ground From
                    </label>
                    <input
                      type="date"
                      value={groundFromDate}
                      onChange={(e) => setGroundFromDate(e.target.value)}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">
                      Reason
                    </label>
                    <textarea
                      value={groundReason}
                      onChange={(e) => setGroundReason(e.target.value)}
                      className="h-24 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      placeholder="Enter grounding reason"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!groundFromDate || !groundReason.trim()) {
                          toast.error("Please select a date and enter a reason");
                          return;
                        }
                        createGrounding.mutate(
                          {
                            equipmentId: selectedEquipmentForMgmt,
                            fromDate: new Date(`${groundFromDate}T00:00:00.000Z`).toISOString(),
                            reason: groundReason,
                          },
                          {
                            onSuccess: () => {
                              toast.success("Equipment grounded successfully");
                              setShowGroundEquipmentModal(false);
                            },
                            onError: (error) => {
                              toast.error(
                                error instanceof Error ? error.message : "Failed to ground equipment",
                              );
                            },
                          },
                        );
                      }}
                      disabled={createGrounding.isPending}
                      className="flex-1 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createGrounding.isPending ? "Grounding..." : "Confirm Grounding"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowGroundEquipmentModal(false)}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEndGroundingModal && selectedEquipmentForMgmt && groundingPeriods.data && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setShowEndGroundingModal(false)}
            >
              <div
                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">End Grounding</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">
                      Grounded Until
                    </label>
                    <input
                      type="date"
                      value={groundEndDate}
                      onChange={(e) => setGroundEndDate(e.target.value)}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const current = groundingPeriods.data?.find(
                          (p) => p.toDate === null || new Date(p.toDate) > new Date(),
                        );
                        if (!current) {
                          setShowEndGroundingModal(false);
                          return;
                        }
                        if (!groundEndDate) {
                          toast.error("Please select an end date");
                          return;
                        }
                        endGrounding.mutate(
                          {
                            equipmentId: selectedEquipmentForMgmt,
                            groundingId: current.id,
                            toDate: new Date(`${groundEndDate}T00:00:00.000Z`).toISOString(),
                          },
                          {
                            onSuccess: () => {
                              toast.success("Grounding ended successfully");
                              setShowEndGroundingModal(false);
                            },
                            onError: (error) => {
                              toast.error(
                                error instanceof Error ? error.message : "Failed to end grounding",
                              );
                            },
                          },
                        );
                      }}
                      disabled={endGrounding.isPending}
                      className="flex-1 rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {endGrounding.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEndGroundingModal(false)}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedHistoryEntry && history.data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedHistoryEntry(null)}>
              <div
                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Entry Details</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">Date</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {formatDate(selectedHistoryEntry.entryDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                      Reading
                    </p>
                    <p className="font-bold text-[var(--color-text)]">
                      {selectedHistoryEntry.hoursRun.toFixed(2)}{" "}
                      {history.data.equipment.usageUnit === "KM" ? "km" : "hours"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                      Created By
                    </p>
                    <p className="font-medium text-[var(--color-text)]">
                      {selectedHistoryEntry.createdBy ?? "Unknown"}
                      {selectedHistoryEntry.createdByEmail
                        ? ` (${selectedHistoryEntry.createdByEmail})`
                        : ""}
                    </p>
                  </div>
                  {selectedHistoryEntry.approvedBy && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                        Approved By
                      </p>
                      <p className="font-medium text-[var(--color-text)]">
                        {selectedHistoryEntry.approvedBy}
                        {selectedHistoryEntry.approvedByEmail
                          ? ` (${selectedHistoryEntry.approvedByEmail})`
                          : ""}{" "}
                        {selectedHistoryEntry.approvedAt
                          ? `on ${formatDate(selectedHistoryEntry.approvedAt)}`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryEntry(null)}
                    className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedHistoryCheck && history.data && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedHistoryCheck(null)}>
              <div
                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  Check {selectedHistoryCheck.checkCode} Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">Status</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {selectedHistoryCheck.status}
                      {selectedHistoryCheck.isMissed ? " (Missed)" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">Due</p>
                    <p className="font-medium text-[var(--color-text)]">
                      {formatDate(selectedHistoryCheck.dueDate)} at{" "}
                      {selectedHistoryCheck.dueHours.toFixed(0)}{" "}
                      {history.data.equipment.usageUnit === "KM" ? "km" : "hours"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                      Trigger Type
                    </p>
                    <p className="font-medium text-[var(--color-text)]">
                      {selectedHistoryCheck.triggerType}
                    </p>
                  </div>
                  {selectedHistoryCheck.issuedAt && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                        Issued At
                      </p>
                      <p className="font-medium text-[var(--color-text)]">
                        {formatDate(selectedHistoryCheck.issuedAt)}
                      </p>
                    </div>
                  )}
                  {selectedHistoryCheck.completedAt && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                        Completed At
                      </p>
                      <p className="font-medium text-[var(--color-text)]">
                        {formatDate(selectedHistoryCheck.completedAt)}
                      </p>
                      {selectedHistoryCheck.completedHours !== null && (
                        <p className="font-medium text-[var(--color-text)]">
                          Completed Reading:{" "}
                          {selectedHistoryCheck.completedHours.toFixed(0)}{" "}
                          {history.data.equipment.usageUnit === "KM" ? "km" : "hours"}
                        </p>
                      )}
                    </div>
                  )}
                  {selectedHistoryCheck.pdfFilePath && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">
                        Reference File
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(selectedHistoryCheck.pdfFilePath as string, "_blank");
                          }
                        }}
                        className="mt-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                      >
                        Open PDF
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryCheck(null)}
                    className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedHistoryGrounding && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedHistoryGrounding(null)}>
              <div
                className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  Grounding Details
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">From</p>
                    <p className="font-medium text-[var(--color-text)]">
                      {formatDate(selectedHistoryGrounding.fromDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">To</p>
                    <p className="font-medium text-[var(--color-text)]">
                      {selectedHistoryGrounding.toDate
                        ? formatDate(selectedHistoryGrounding.toDate)
                        : "Present"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-soft)]">Reason</p>
                    <p className="font-medium text-[var(--color-text)]">
                      {selectedHistoryGrounding.reason}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryGrounding(null)}
                    className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCheckSheetModal && selectedEquipmentForMgmt && equipmentDetail.data && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCheckSheetModal(false)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Edit Check Sheet</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Check Code</label>
                    <input
                      type="text"
                      value={checkSheetCode}
                      onChange={(e) => setCheckSheetCode(e.target.value.toUpperCase().slice(0, 1))}
                      maxLength={1}
                      className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Due Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={checkSheetDueHours}
                        onChange={(e) => setCheckSheetDueHours(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Due Date</label>
                      <input
                        type="datetime-local"
                        value={checkSheetDueDate}
                        onChange={(e) => setCheckSheetDueDate(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Trigger Type</label>
                      <select
                        value={checkSheetTriggerType}
                        onChange={(e) => setCheckSheetTriggerType(e.target.value as "HOURS" | "CALENDAR")}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="HOURS">Hours</option>
                        <option value="CALENDAR">Calendar</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Status</label>
                      <select
                        value={checkSheetStatus}
                        onChange={(e) => setCheckSheetStatus(e.target.value as typeof checkSheetStatus)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      >
                        <option value="PREDICTED">Predicted</option>
                        <option value="ISSUE_REQUIRED">Issue Required</option>
                        <option value="NEAR_DUE">Near Due</option>
                        <option value="ISSUED">Issued</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="OVERDUE">Overdue</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Issued At</label>
                      <input
                        type="datetime-local"
                        value={checkSheetIssuedAt}
                        onChange={(e) => setCheckSheetIssuedAt(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Completed At</label>
                      <input
                        type="datetime-local"
                        value={checkSheetCompletedAt}
                        onChange={(e) => setCheckSheetCompletedAt(e.target.value)}
                        className="h-10 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateCheckSheetDetail.mutate(
                          {
                            equipmentId: selectedEquipmentForMgmt,
                            sheetId: editingCheckSheetId!,
                            checkCode: checkSheetCode,
                            dueHours: Number(checkSheetDueHours),
                            dueDate: checkSheetDueDate ? new Date(checkSheetDueDate).toISOString() : undefined,
                            triggerType: checkSheetTriggerType,
                            status: checkSheetStatus,
                            issuedAt: checkSheetIssuedAt ? new Date(checkSheetIssuedAt).toISOString() : null,
                            completedAt: checkSheetCompletedAt ? new Date(checkSheetCompletedAt).toISOString() : null,
                          },
                          {
                            onSuccess: () => {
                              toast.success("Check sheet updated successfully");
                              setShowCheckSheetModal(false);
                              setEditingCheckSheetId(null);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to update check sheet");
                            },
                          }
                        );
                      }}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCheckSheetModal(false);
                        setEditingCheckSheetId(null);
                      }}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showEquipmentDetailsModal && selectedEquipmentForMgmt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowEquipmentDetailsModal(false)}>
              <div className="relative w-full max-w-6xl rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-[var(--color-text)]">
                    Equipment Details {equipmentDetail.data ? `- ${equipmentDetail.data.equipmentNumber}` : ""}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowEquipmentDetailsModal(false)}
                    className="text-2xl font-bold text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors"
                  >
                    ×
                  </button>
                </div>
                {equipmentDetail.isLoading ? (
                  <div className="py-8 text-center">
                    <p className="text-sm font-medium text-[var(--color-text-soft)]">Loading equipment details...</p>
                  </div>
                ) : equipmentDetail.data ? (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-[var(--color-text)]">Grounding</h4>
                        <div className="flex gap-2">
                          {(() => {
                            const current =
                              groundingPeriods.data?.find(
                                (p) => p.toDate === null || new Date(p.toDate) > new Date(),
                              ) ?? null;
                            if (current) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGroundEndDate(new Date().toISOString().slice(0, 10));
                                    setShowEndGroundingModal(true);
                                  }}
                                  className="rounded-lg border-2 border-green-600 bg-white px-3 py-1.5 text-xs font-bold text-green-700 transition-all hover:bg-green-600 hover:text-white"
                                >
                                  End Grounding
                                </button>
                              );
                            }
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setGroundFromDate(new Date().toISOString().slice(0, 10));
                                  setGroundReason("");
                                  setShowGroundEquipmentModal(true);
                                }}
                                className="rounded-lg border-2 border-yellow-500 bg-white px-3 py-1.5 text-xs font-bold text-yellow-600 transition-all hover:bg-yellow-500 hover:text-white"
                              >
                                Ground Equipment
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {groundingPeriods.isLoading ? (
                          <p className="text-xs text-[var(--color-text-soft)]">Loading grounding periods...</p>
                        ) : groundingPeriods.data && groundingPeriods.data.length > 0 ? (
                          groundingPeriods.data.map((p) => (
                            <div
                              key={p.id}
                              className="rounded-lg border border-[var(--color-surface-strong)] bg-white px-3 py-2 text-xs"
                            >
                              <p className="font-semibold text-[var(--color-text)]">
                                {formatDate(p.fromDate)}{" "}
                                {p.toDate ? `→ ${formatDate(p.toDate)}` : "→ Present"}
                              </p>
                              <p className="text-[var(--color-text-soft)] mt-1">{p.reason}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[var(--color-text-soft)]">
                            No grounding periods recorded for this equipment.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold text-[var(--color-text)]">Check Rules</h4>
                      <div className="mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCheckRuleId(null);
                            setShowCheckRuleModal(true);
                          }}
                          className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                        >
                          + Add Check Rule
                        </button>
                      </div>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {(equipmentCheckRules.data ?? []).map((rule) => (
                          <div
                            key={rule.id}
                            className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">Check {rule.code}</span>
                                  {!rule.isActive && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">Inactive</span>}
                                </div>
                                <div className="space-y-1">
                                  <p className="font-semibold text-[var(--color-text-soft)] text-xs mb-1">Interval Hours</p>
                                  <p className="font-bold text-[var(--color-text)] text-sm">{rule.intervalHours}</p>
                                  <p className="font-semibold text-[var(--color-text-soft)] text-xs mt-2">Time Interval</p>
                                  <p className="font-bold text-[var(--color-text)] text-sm">
                                    {rule.intervalTimeValue && rule.intervalTimeValue > 0
                                      ? `${rule.intervalTimeValue} ${rule.intervalTimeUnit === "YEARS" ? "year(s)" : "month(s)"}`
                                      : "Not set"}
                                  </p>
                                  <p className="text-[11px] text-[var(--color-text-soft)]">
                                    Template PDF:{" "}
                                    {rule.templatePdfPath ? (
                                      <span className="text-green-600 font-semibold">Uploaded</span>
                                    ) : (
                                      <span className="text-gray-400">Not uploaded</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCheckRuleId(rule.id);
                                    setShowCheckRuleModal(true);
                                  }}
                                  className="rounded-lg border-2 border-[var(--color-primary)] bg-white px-2 py-1 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={!rule.templatePdfPath}
                                  onClick={() => {
                                    if (rule.templatePdfPath && typeof window !== "undefined") {
                                      window.open(rule.templatePdfPath, "_blank", "noopener,noreferrer");
                                    }
                                  }}
                                  className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-2 py-1 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  View Template
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowRulePdfUploadModal(rule.id);
                                    setPdfUploadFile(null);
                                  }}
                                  className="rounded-lg border-2 border-orange-500 bg-white px-2 py-1 text-xs font-bold text-orange-500 transition-all hover:bg-orange-500 hover:text-white"
                                >
                                  {rule.templatePdfPath ? "Replace PDF" : "Upload PDF"}
                                </button>
                                {rule.templatePdfPath && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirmModal({
                                        type: "checkRule",
                                        id: rule.id,
                                        name: `Template PDF for Check ${rule.code}`,
                                        onConfirm: () => {
                                          deleteCheckRuleTemplatePdf.mutate(
                                            { equipmentId: selectedEquipmentForMgmt!, ruleId: rule.id },
                                            {
                                              onSuccess: () => {
                                                toast.success("Template PDF deleted successfully");
                                                setDeleteConfirmModal(null);
                                              },
                                              onError: (error) => {
                                                toast.error(error instanceof Error ? error.message : "Failed to delete template PDF");
                                                setDeleteConfirmModal(null);
                                              },
                                            }
                                          );
                                        },
                                      });
                                    }}
                                    className="rounded-lg border-2 border-red-500 bg-white px-2 py-1 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                  >
                                    Delete PDF
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmModal({
                                      type: "checkRule",
                                      id: rule.id,
                                      name: `Check ${rule.code}`,
                                      onConfirm: () => {
                                        deleteCheckRule.mutate(
                                          { equipmentId: selectedEquipmentForMgmt!, ruleId: rule.id },
                                          {
                                            onSuccess: () => {
                                              toast.success("Check rule deleted successfully");
                                              setDeleteConfirmModal(null);
                                            },
                                            onError: (error) => {
                                              toast.error(error instanceof Error ? error.message : "Failed to delete check rule");
                                              setDeleteConfirmModal(null);
                                            },
                                          }
                                        );
                                      },
                                    });
                                  }}
                                  className="rounded-lg border-2 border-red-500 bg-white px-2 py-1 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!equipmentCheckRules.data || equipmentCheckRules.data.length === 0) && (
                          <div className="py-8 text-center text-xs text-[var(--color-text-soft)]">No check rules</div>
                        )}
                      </div>
                    </div>
                    {false && <div className="space-y-4">
                      <h4 className="text-sm font-bold text-[var(--color-text)]">Check Sheets</h4>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {(equipmentDetail.data?.checkSheets ?? []).map((sheet) => (
                          <div
                            key={sheet.id}
                            className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white p-4"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">Check {sheet.checkCode}</span>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(sheet.status).badge}`}>
                                    {getStatusLabel(sheet.status)}
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs">
                                  <p className="font-semibold text-[var(--color-text-soft)]">
                                    Due: {formatDate(sheet.dueDate)} at {sheet.dueHours.toFixed(0)} hours
                                  </p>
                                  <p className="text-[var(--color-text-soft)]">
                                    Trigger: {sheet.triggerType}
                                  </p>
                                  {sheet.issuedAt && (
                                    <p className="text-[var(--color-text-soft)]">
                                      Issued: {formatDate(sheet.issuedAt)}
                                    </p>
                                  )}
                                  {sheet.completedAt && (
                                    <p className="text-[var(--color-text-soft)]">
                                      Completed: {formatDate(sheet.completedAt)}
                                    </p>
                                  )}
                                  <p className="text-[var(--color-text-soft)]">
                                    PDF: {sheet.pdfFilePath ? (
                                      <span className="text-green-600 font-semibold">✓ Uploaded</span>
                                    ) : (
                                      <span className="text-gray-400">Not uploaded</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 ml-4">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCheckSheetId(sheet.id);
                                    setShowCheckSheetModal(true);
                                  }}
                                  className="rounded-lg border-2 border-[var(--color-primary)] bg-white px-2 py-1 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)] hover:text-white"
                                >
                                  Edit
                                </button>
                                {sheet.pdfFilePath ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setShowPdfPreviewModal(sheet.id);
                                      }}
                                      className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-2 py-1 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
                                    >
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowPdfUploadModal(sheet.id)}
                                      className="rounded-lg border-2 border-orange-500 bg-white px-2 py-1 text-xs font-bold text-orange-500 transition-all hover:bg-orange-500 hover:text-white"
                                    >
                                      Replace
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDeleteConfirmModal({
                                          type: "checkSheet",
                                          id: sheet.id,
                                          name: `PDF file for Check ${sheet.checkCode}`,
                                          onConfirm: () => {
                                            deleteCheckSheetPdf.mutate(sheet.id, {
                                              onSuccess: () => {
                                                toast.success("PDF file deleted successfully");
                                                setDeleteConfirmModal(null);
                                              },
                                              onError: (error) => {
                                                toast.error(error instanceof Error ? error.message : "Failed to delete PDF file");
                                                setDeleteConfirmModal(null);
                                              },
                                            });
                                          },
                                        });
                                      }}
                                      className="rounded-lg border-2 border-red-500 bg-white px-2 py-1 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                    >
                                      Delete PDF
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setShowPdfUploadModal(sheet.id)}
                                    className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-2 py-1 text-xs font-bold text-white transition-all hover:scale-105 hover:shadow-lg"
                                  >
                                    Upload PDF
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteConfirmModal({
                                      type: "checkSheet",
                                      id: sheet.id,
                                      name: `Check ${sheet.checkCode}`,
                                      onConfirm: () => {
                                        deleteCheckSheetDetail.mutate(
                                          { equipmentId: selectedEquipmentForMgmt!, sheetId: sheet.id },
                                          {
                                            onSuccess: () => {
                                              toast.success("Check sheet deleted successfully");
                                              setDeleteConfirmModal(null);
                                            },
                                            onError: (error) => {
                                              toast.error(error instanceof Error ? error.message : "Failed to delete check sheet");
                                              setDeleteConfirmModal(null);
                                            },
                                          }
                                        );
                                      },
                                    });
                                  }}
                                  className="rounded-lg border-2 border-red-500 bg-white px-2 py-1 text-xs font-bold text-red-500 transition-all hover:bg-red-500 hover:text-white"
                                >
                                  Delete Sheet
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(equipmentDetail.data?.checkSheets ?? []).length === 0 && (
                          <div className="py-8 text-center text-xs text-[var(--color-text-soft)]">No check sheets</div>
                        )}
                      </div>
                    </div>}
                  </div>
                ) : equipmentDetail.error ? (
                  <div className="py-8 text-center">
                    <p className="text-sm font-medium text-red-600">Failed to load equipment details</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEquipmentForMgmt(null);
                        setTimeout(() => setSelectedEquipmentForMgmt(selectedEquipmentForMgmt), 100);
                      }}
                      className="mt-2 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                    >
                      Retry
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {showPdfPreviewModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => {
              setShowPdfPreviewModal(null);
            }}>
              <div className="relative w-full max-w-5xl h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b-2 border-[var(--color-surface-strong)]">
                  <h3 className="text-lg font-bold text-[var(--color-text)]">PDF Preview</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPdfPreviewModal(null);
                    }}
                    className="text-2xl font-bold text-[var(--color-text-soft)] hover:text-[var(--color-text)] transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="h-full p-4 overflow-auto">
                  {showPdfPreviewModal ? (
                    <iframe
                      src={apiPath(`/api/checksheets/${showPdfPreviewModal}/file`)}
                      className="w-full h-full border-0 rounded-lg"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm font-medium text-[var(--color-text-soft)]">Loading PDF...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {showPdfUploadModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowPdfUploadModal(null)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  {(() => {
                    const sheet = allCheckSheets.data?.find((s) => s.id === showPdfUploadModal);
                    return sheet ? `Upload PDF - ${sheet.equipmentNumber} Check ${sheet.checkCode}` : "Upload PDF";
                  })()}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">PDF File</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            toast.error("Only PDF files are allowed");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("File size must be less than 10MB");
                            return;
                          }
                          setPdfUploadFile(file);
                        }
                      }}
                      className="block w-full text-xs text-[var(--color-text-soft)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--color-primary-dark)]"
                    />
                    {pdfUploadFile && (
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                        Selected: {pdfUploadFile.name} ({(pdfUploadFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!pdfUploadFile || !showPdfUploadModal) return;
                        uploadCheckSheetPdf.mutate(
                          { checkSheetId: showPdfUploadModal, file: pdfUploadFile },
                          {
                            onSuccess: () => {
                              toast.success("PDF uploaded successfully");
                              setShowPdfUploadModal(null);
                              setPdfUploadFile(null);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to upload PDF");
                            },
                          }
                        );
                      }}
                      disabled={!pdfUploadFile || uploadCheckSheetPdf.isPending}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadCheckSheetPdf.isPending ? "Uploading..." : "Upload"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPdfUploadModal(null);
                        setPdfUploadFile(null);
                      }}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedAllChecksSheet && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={() => setSelectedAllChecksSheet(null)}
            >
              <div
                className="relative w-full max-w-lg rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">
                  {selectedAllChecksSheet.equipmentNumber} • Check {selectedAllChecksSheet.checkCode}
                </h3>
                <p className="text-xs font-medium text-[var(--color-text-soft)] mb-4">
                  {selectedAllChecksSheet.equipmentName}
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                  <div>
                    <p className="font-semibold text-[var(--color-text-soft)]">Status</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {getStatusLabel(selectedAllChecksSheet.status)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-soft)]">Trigger Type</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {selectedAllChecksSheet.triggerType === "HOURS"
                        ? "Hours-based trigger"
                        : "Calendar-based trigger"}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-soft)]">Due Date</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {formatDate(selectedAllChecksSheet.dueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-soft)]">Due Hours</p>
                    <p className="font-bold text-[var(--color-text)]">
                      {selectedAllChecksSheet.dueHours.toFixed(0)}
                    </p>
                  </div>
                  {selectedAllChecksSheet.issuedAt && (
                    <div>
                      <p className="font-semibold text-[var(--color-text-soft)]">Issued At</p>
                      <p className="font-bold text-[var(--color-text)]">
                        {formatDate(selectedAllChecksSheet.issuedAt)}
                      </p>
                    </div>
                  )}
                  {selectedAllChecksSheet.completedAt && (
                    <div>
                      <p className="font-semibold text-[var(--color-text-soft)]">Completed At</p>
                      <p className="font-bold text-[var(--color-text)]">
                        {formatDate(selectedAllChecksSheet.completedAt)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">Template Document</p>
                      <p className="text-[11px] text-[var(--color-text-soft)]">
                        {selectedAllChecksSheet.pdfFilePath
                          ? "Template PDF is available for this check."
                          : "No template PDF uploaded for this check."}
                      </p>
                    </div>
                    {selectedAllChecksSheet.pdfFilePath && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(
                              apiPath(`/api/checksheets/${selectedAllChecksSheet.id}/file`),
                              "_blank",
                              "noopener,noreferrer",
                            );
                          }
                        }}
                        className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                      >
                        Open Template PDF
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-[var(--color-text-soft)]">Completed Reference</p>
                      <p className="text-[11px] text-[var(--color-text-soft)]">
                        If a completed reference document was uploaded, it will open in a new tab.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.open(
                            apiPath(`/api/checksheets/${selectedAllChecksSheet.id}/completed-file`),
                            "_blank",
                            "noopener,noreferrer",
                          );
                        }
                      }}
                      className="rounded-lg bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                    >
                      Open Reference PDF
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedAllChecksSheet(null)}
                    className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCompletedPdfUploadModal && (() => {
            const sheet = (checksheets.data ?? []).find((s) => s.id === showCompletedPdfUploadModal);
            if (!sheet) return null;
            return (
              <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowCompletedPdfUploadModal(null)}>
                <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">
                    Upload / Replace Reference PDF - {sheet.equipmentNumber} Check {sheet.checkCode}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">Reference PDF</label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.type !== "application/pdf") {
                            toast.error("Only PDF files are allowed");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("File size must be less than 10MB");
                            return;
                          }
                          uploadCompletedCheckPdf.mutate(
                            { checkSheetId: sheet.id, file },
                            {
                              onSuccess: () => {
                                toast.success("Reference PDF uploaded");
                                setShowCompletedPdfUploadModal(null);
                              },
                              onError: (error) => {
                                toast.error(
                                  error instanceof Error ? error.message : "Failed to upload reference PDF",
                                );
                              },
                            },
                          );
                        }}
                        className="block w-full text-xs text-[var(--color-text-soft)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--color-primary-dark)]"
                      />
                      <p className="mt-1 text-[11px] text-[var(--color-text-soft)]">
                        Upload the completed reference document for this check.
                      </p>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCompletedPdfUploadModal(null)}
                        className="rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {showRulePdfUploadModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowRulePdfUploadModal(null)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  {(() => {
                    const rule = (equipmentCheckRules.data ?? []).find((r) => r.id === showRulePdfUploadModal);
                    return rule ? `Upload Template PDF - Check ${rule.code}` : "Upload Template PDF";
                  })()}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">PDF File</label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type !== "application/pdf") {
                            toast.error("Only PDF files are allowed");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            toast.error("File size must be less than 10MB");
                            return;
                          }
                          setPdfUploadFile(file);
                        }
                      }}
                      className="block w-full text-xs text-[var(--color-text-soft)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[var(--color-primary-dark)]"
                    />
                    {pdfUploadFile && (
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">
                        Selected: {pdfUploadFile.name} ({(pdfUploadFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!pdfUploadFile || !showRulePdfUploadModal || !selectedEquipmentForMgmt) return;
                        uploadCheckRuleTemplatePdf.mutate(
                          { equipmentId: selectedEquipmentForMgmt, ruleId: showRulePdfUploadModal, file: pdfUploadFile },
                          {
                            onSuccess: () => {
                              toast.success("Template PDF uploaded successfully");
                              setShowRulePdfUploadModal(null);
                              setPdfUploadFile(null);
                            },
                            onError: (error) => {
                              toast.error(error instanceof Error ? error.message : "Failed to upload template PDF");
                            },
                          }
                        );
                      }}
                      disabled={!pdfUploadFile || uploadCheckRuleTemplatePdf.isPending}
                      className="flex-1 rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadCheckRuleTemplatePdf.isPending ? "Uploading..." : "Upload"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRulePdfUploadModal(null);
                        setPdfUploadFile(null);
                      }}
                      className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDeleteConfirmModal(null)}>
              <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-[var(--color-text)] mb-3">Confirm Delete</h3>
                <p className="text-sm font-medium text-[var(--color-text-soft)] mb-4">
                  Are you sure you want to delete {deleteConfirmModal.name}? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      deleteConfirmModal.onConfirm();
                    }}
                    className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmModal(null)}
                    className="flex-1 rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-4 py-2 text-sm font-bold text-[var(--color-text)] transition-all hover:bg-[var(--color-surface-strong)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "admin" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card title="Equipment Configuration">
                {canAdmin ? (
                  <form className="space-y-4" onSubmit={onCreateEquipment}>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Equipment Number</label>
                      <input
                        required
                        value={equipmentNumber}
                        onChange={(e) => setEquipmentNumber(e.target.value)}
                        className={inputClass}
                        placeholder="E.g., 116"
                        maxLength={40}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Avg Hours/Day</label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={0.1}
                          value={avgHours}
                          onChange={(e) => setAvgHours(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Current Hours</label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={0.1}
                          value={currentHours}
                          onChange={(e) => setCurrentHours(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Previous Check Code</label>
                        <input
                          type="text"
                          value={previousCheckCode}
                          onChange={(e) => setPreviousCheckCode(e.target.value.toUpperCase().slice(0, 1))}
                          className={inputClass}
                          placeholder="A"
                          maxLength={1}
                          pattern="[A-Z]"
                        />
                        <p className="mt-1 text-xs text-[var(--color-text-soft)]">Optional: Last completed check</p>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Previous Check Date</label>
                        <input
                          type="date"
                          value={previousCheckDate}
                          onChange={(e) => setPreviousCheckDate(e.target.value)}
                          className={inputClass}
                          disabled={!previousCheckCode}
                        />
                        <p className="mt-1 text-xs text-[var(--color-text-soft)]">Date when check was completed</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="block text-sm font-bold text-[var(--color-text)]">Check Rules</label>
                        <button
                          type="button"
                          onClick={addCheckRule}
                          disabled={checkRules.length >= 26}
                          className="rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          + Add Check
                        </button>
                      </div>
                      <div className="space-y-2">
                        {checkRules.map((rule, index) => {
                          const isDuplicate = checkRules.filter((r) => r.code.toUpperCase() === rule.code.toUpperCase()).length > 1;
                          const isValidCode = /^[A-Z]$/.test(rule.code);
                          const isValidHours = rule.intervalHours && Number(rule.intervalHours) > 0;

                          return (
                            <div
                              key={index}
                              className={`flex gap-2 rounded-lg border-2 p-3 ${
                                isDuplicate || !isValidCode || !isValidHours
                                  ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5"
                                  : "border-[var(--color-surface-strong)] bg-white"
                              }`}
                            >
                              <div className="w-20">
                                <input
                                  type="text"
                                  required
                                  value={rule.code}
                                  onChange={(e) => updateCheckRule(index, "code", e.target.value)}
                                  className={`h-11 w-full rounded-lg border-2 px-3 text-center text-sm font-bold uppercase outline-none transition-all ${
                                    isDuplicate || !isValidCode
                                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                                      : "border-[var(--color-surface-strong)] bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                  }`}
                                  placeholder="A"
                                  maxLength={1}
                                  pattern="[A-Z]"
                                />
                                <p className="mt-1 text-[10px] font-medium text-[var(--color-text-soft)]">Code</p>
                              </div>
                              <div className="flex-1">
                                <input
                                  type="number"
                                  required
                                  min={1}
                                  step={1}
                                  value={rule.intervalHours}
                                  onChange={(e) => updateCheckRule(index, "intervalHours", e.target.value)}
                                  className={`h-11 w-full rounded-lg border-2 px-3 text-sm font-semibold outline-none transition-all ${
                                    !isValidHours
                                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                                      : "border-[var(--color-surface-strong)] bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                                  }`}
                                  placeholder="500"
                                />
                                <p className="mt-1 text-[10px] font-medium text-[var(--color-text-soft)]">Interval Hours</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCheckRule(index)}
                                disabled={checkRules.length === 1}
                                className="mt-6 h-11 rounded-lg bg-[var(--color-accent)] px-4 text-sm font-bold text-white transition-all hover:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      {checkRules.length === 0 && (
                        <p className="py-4 text-center text-sm font-medium text-[var(--color-text-soft)]">
                          No check rules. Click "Add Check" to add one.
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={
                        !equipmentNumber ||
                        checkRules.length === 0 ||
                        checkRules.some(
                          (r) =>
                            !/^[A-Z]$/.test(r.code) ||
                            !r.intervalHours ||
                            Number(r.intervalHours) <= 0 ||
                            checkRules.filter((rule) => rule.code.toUpperCase() === r.code.toUpperCase()).length > 1
                        )
                      }
                      className="w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Create Equipment
                    </button>
                  </form>
                ) : (
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Admin access required</p>
                )}
              </Card>

              <Card title="User Management">
                {isSuperadmin ? (
                  <div className="space-y-6">
                    <form className="space-y-4" onSubmit={onCreateUser}>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Full Name</label>
                        <input required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Email</label>
                        <input required type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Password</label>
                        <input required type="password" minLength={8} value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-[var(--color-text)]">Role</label>
                        <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)} className={inputClass}>
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPERADMIN">SUPERADMIN</option>
                        </select>
                      </div>
                      <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-[var(--color-accent)]/30 transition-all hover:scale-[1.02] hover:shadow-xl">
                        Create User
                      </button>
                    </form>

                    <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md">
                      <label className="mb-3 block text-sm font-bold text-[var(--color-text)]">Permission Matrix</label>
                      <select
                        value={permissionUserId}
                        onChange={(e) => {
                          setPermissionUserId(e.target.value);
                          loadPermissionMap(e.target.value);
                        }}
                        className={inputClass}
                      >
                        <option value="">Select user</option>
                        {(users.data ?? []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.role})
                          </option>
                        ))}
                      </select>
                      {permissionUserId && (
                        <div className="mt-4 space-y-2">
                          {catalog.map((perm) => (
                            <label key={perm.key} className="flex items-center justify-between rounded-lg bg-white p-3 border border-[var(--color-surface-strong)] hover:border-[var(--color-primary)]/30 transition-colors">
                              <span className="text-sm font-semibold text-[var(--color-text)]">{perm.name}</span>
                              <input
                                type="checkbox"
                                checked={Boolean(permissionMap[perm.key])}
                                onChange={(e) => setPermissionMap((prev) => ({ ...prev, [perm.key]: e.target.checked }))}
                                className="h-5 w-5 accent-[var(--color-primary)]"
                              />
                            </label>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              updatePermissions.mutate(
                                {
                                  userId: permissionUserId,
                                  permissions: catalog.map((p) => ({ key: p.key, name: p.name, allowed: Boolean(permissionMap[p.key]) })),
                                },
                                {
                                  onSuccess: () => {
                                    const user = (users.data ?? []).find((u) => u.id === permissionUserId);
                                    toast.success(`Permissions updated for ${user?.fullName || "user"}`);
                                  },
                                  onError: (error) => {
                                    toast.error(error instanceof Error ? error.message : "Failed to update permissions");
                                  },
                                }
                              )
                            }
                            className="mt-4 w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:scale-[1.02] hover:shadow-xl"
                          >
                            Save Permissions
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Superadmin access required</p>
                )}
              </Card>

              <Card title="System Configuration">
                {canAdmin ? (
                  <div className="space-y-6">
                    <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md">
                      <label className="mb-3 block text-sm font-bold text-[var(--color-text)]">Reminder Hours Before Due</label>
                      <p className="mb-3 text-xs text-[var(--color-text-soft)]">
                        Configure the number of hours before a maintenance check is due when reminders should start appearing. This applies to all equipment checks.
                      </p>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          step={1}
                          value={reminderHours}
                          onChange={(e) => setReminderHours(e.target.value)}
                          className="h-12 flex-1 rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm"
                          placeholder="120"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateSystemConfig.mutate(
                              { reminderHoursBefore: Number(reminderHours) },
                              {
                                onSuccess: () => {
                                  toast.success("Reminder hours configuration updated successfully");
                                },
                                onError: (error) => {
                                  toast.error(error instanceof Error ? error.message : "Failed to update configuration");
                                },
                              }
                            )
                          }
                          disabled={!reminderHours || Number(reminderHours) < 1 || Number(reminderHours) > 10000 || systemConfig.isLoading}
                          className="rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {systemConfig.isLoading ? "Saving..." : "Save"}
                        </button>
                      </div>
                      {systemConfig.data && (
                        <p className="mt-2 text-xs font-medium text-[var(--color-text-soft)]">
                          Current value: {systemConfig.data.reminderHoursBefore} hours
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md">
                      <label className="mb-3 block text-sm font-bold text-[var(--color-text)]">Check Status Threshold Hours</label>
                      <p className="mb-3 text-xs text-[var(--color-text-soft)]">
                        Configure the number of hours before a maintenance check is due when the status changes. These thresholds apply system-wide to all equipment checks.
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[var(--color-text-soft)]">Approaching (Upcoming)</label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            value={approachingHours}
                            onChange={(e) => setApproachingHours(e.target.value)}
                            className="h-11 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 shadow-sm"
                            placeholder="120"
                          />
                          <p className="mt-1 text-[10px] text-[var(--color-text-soft)]">Hours before due when status becomes 'Approaching'</p>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[var(--color-text-soft)]">Issue Required (Due)</label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            value={issueHours}
                            onChange={(e) => setIssueHours(e.target.value)}
                            className="h-11 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium outline-none transition-all focus:border-red-400 focus:ring-2 focus:ring-red-400/20 shadow-sm"
                            placeholder="40"
                          />
                          <p className="mt-1 text-[10px] text-[var(--color-text-soft)]">Hours before due when status becomes 'Issue Required'</p>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold text-[var(--color-text-soft)]">Critical (Near Due)</label>
                          <input
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            value={nearHours}
                            onChange={(e) => setNearHours(e.target.value)}
                            className="h-11 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-sm font-medium outline-none transition-all focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 shadow-sm"
                            placeholder="10"
                          />
                          <p className="mt-1 text-[10px] text-[var(--color-text-soft)]">Hours before due when status becomes 'Critical'</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateSystemConfig.mutate(
                            {
                              approachingOffsetHours: Number(approachingHours),
                              issueOffsetHours: Number(issueHours),
                              nearOffsetHours: Number(nearHours),
                            },
                            {
                              onSuccess: () => {
                                toast.success("Status threshold hours updated successfully");
                              },
                              onError: (error) => {
                                toast.error(error instanceof Error ? error.message : "Failed to update configuration");
                              },
                            }
                          )
                        }
                        disabled={
                          !approachingHours || !issueHours || !nearHours ||
                          Number(approachingHours) < 0 || Number(approachingHours) > 10000 ||
                          Number(issueHours) < 0 || Number(issueHours) > 10000 ||
                          Number(nearHours) < 0 || Number(nearHours) > 10000 ||
                          systemConfig.isLoading
                        }
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {systemConfig.isLoading ? "Saving..." : "Save Threshold Hours"}
                      </button>
                      {systemConfig.data && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <p className="font-medium text-[var(--color-text-soft)]">
                            Approaching: <span className="font-bold text-[var(--color-text)]">{systemConfig.data.approachingOffsetHours} hours</span>
                          </p>
                          <p className="font-medium text-[var(--color-text-soft)]">
                            Issue Required: <span className="font-bold text-[var(--color-text)]">{systemConfig.data.issueOffsetHours} hours</span>
                          </p>
                          <p className="font-medium text-[var(--color-text-soft)]">
                            Critical: <span className="font-bold text-[var(--color-text)]">{systemConfig.data.nearOffsetHours} hours</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">Admin access required</p>
                )}
              </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border-2 border-[var(--color-surface-strong)] bg-white px-4 text-sm font-medium outline-none transition-all focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary)]/20 shadow-sm";

function Card({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-6 shadow-xl ${className}`}>
      <h2 className="mb-5 text-xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text text-transparent">{title}</h2>
      {children}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  accent = "primary", 
  icon,
  description,
  badge,
  statusColor = "blue",
  onClick
}: { 
  title: string; 
  value: string; 
  accent?: "primary" | "accent";
  icon?: string;
  description?: string;
  badge?: number;
  statusColor?: "blue" | "green" | "yellow" | "red";
  onClick?: () => void;
}) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "red":
        return {
          gradient: "from-red-100 to-red-50",
          border: "border-red-400",
          iconBg: "bg-gradient-to-br from-red-500 to-red-600",
          text: "text-red-900"
        };
      case "yellow":
        return {
          gradient: "from-yellow-100 to-yellow-50",
          border: "border-yellow-400",
          iconBg: "bg-gradient-to-br from-yellow-500 to-yellow-600",
          text: "text-yellow-900"
        };
      case "green":
        return {
          gradient: "from-green-100 to-green-50",
          border: "border-green-400",
          iconBg: "bg-gradient-to-br from-green-500 to-green-600",
          text: "text-green-900"
        };
      default:
        return {
          gradient: "from-blue-100 to-blue-50",
          border: "border-blue-400",
          iconBg: "bg-gradient-to-br from-blue-500 to-blue-600",
          text: "text-blue-900"
        };
    }
  };

  const colors = getColorClasses(statusColor);
  
  return (
    <div 
      className={`relative rounded-xl border-2 ${colors.border} bg-gradient-to-br ${colors.gradient} p-4 shadow-md transition-all hover:scale-[1.02] hover:shadow-lg ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {icon && (
              <div className={`rounded-lg ${colors.iconBg} p-1.5 text-base text-white shadow-sm`}>
                {icon}
              </div>
            )}
            <p className={`text-[10px] font-bold uppercase tracking-wide ${colors.text} opacity-75 truncate`}>{title}</p>
          </div>
          <p className={`text-2xl font-bold ${colors.text} mb-1`}>{value}</p>
          {description && (
            <p className={`text-[10px] font-medium ${colors.text} opacity-70`}>{description}</p>
          )}
        </div>
        {badge !== undefined && badge > 0 && (
          <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-red-700 text-xs font-bold text-white shadow-md">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
} 
