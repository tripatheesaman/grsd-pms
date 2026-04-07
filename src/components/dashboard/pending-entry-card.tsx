"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils/date";
import type { PendingEntryItem } from "@/hooks/use-dashboard-data";

export type PendingEntryCardProps = {
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

export function PendingEntryCard({
  entry,
  onApprove,
  onReject,
  onUpdate,
  onDelete,
  isApproving,
  isRejecting,
  isUpdating,
  isDeleting,
}: PendingEntryCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(entry.entryDate.slice(0, 10));
  const [editHours, setEditHours] = useState(String(entry.hoursRun));
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const unitLabel = entry.usageUnit === "KM" ? "Kilometers" : "Hours";
  const hoursError =
    Number(editHours) < entry.previousHours
      ? `${unitLabel} must be at least ${entry.previousHours.toFixed(2)} (previous entry value)`
      : undefined;

  return (
    <div className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <p className="text-base font-bold text-[var(--color-text)]">{entry.equipmentNumber}</p>
            <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-800">
              PENDING
            </span>
          </div>
          <p className="mb-1 text-sm font-medium text-[var(--color-text-soft)]">
            Created by: {entry.createdBy} ({entry.createdByEmail})
          </p>
          <p className="text-xs text-[var(--color-text-soft)]">Created: {formatDate(entry.createdAt)}</p>
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--color-text-soft)]">Entry Date</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{formatDate(entry.entryDate)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--color-text-soft)]">
                {unitLabel === "Kilometers" ? "Kilometers" : "Hours Run"}
              </p>
              <p className="text-sm font-bold text-[var(--color-text)]">{entry.hoursRun.toFixed(2)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t-2 border-[var(--color-surface-strong)] pt-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--color-text-soft)]">Previous Entry Date</p>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {entry.previousEntryDate ? formatDate(entry.previousEntryDate) : "N/A"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--color-text-soft)]">Previous {unitLabel}</p>
              <p className="text-sm font-medium text-[var(--color-text)]">{entry.previousHours.toFixed(2)}</p>
            </div>
          </div>
          <div className="border-t-2 border-[var(--color-surface-strong)] pt-3">
            <p className="mb-1 text-xs font-semibold text-[var(--color-text-soft)]">Current Equipment {unitLabel}</p>
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
            <p className="mt-2 text-xs font-medium text-red-600">
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
              <label className="mb-1 block text-xs font-semibold text-[var(--color-text-soft)]">
                {unitLabel === "Kilometers" ? "Kilometers" : "Hours Run"}
              </label>
              <input
                type="number"
                min={entry.previousHours}
                step={0.1}
                value={editHours}
                onChange={(e) => setEditHours(e.target.value)}
                className={`h-10 w-full rounded-lg border-2 ${hoursError ? "border-red-400" : "border-[var(--color-surface-strong)]"} bg-white px-3 text-sm font-medium text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20`}
              />
              {hoursError && <p className="mt-1 text-xs font-medium text-red-600">{hoursError}</p>}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowRejectModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold text-[var(--color-text)]">Reject Entry</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-[var(--color-text)]">
                  Reason (Optional)
                </label>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-gradient-to-br from-white to-[var(--color-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-bold text-[var(--color-text)]">Delete Entry</h3>
            <div className="space-y-4">
              <p className="text-sm font-medium text-[var(--color-text-soft)]">
                Are you sure you want to delete this entry? This action cannot be undone.
              </p>
              <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-3">
                <p className="mb-1 text-xs font-semibold text-yellow-800">Entry Details:</p>
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
