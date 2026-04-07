"use client";

import toast from "react-hot-toast";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { Card } from "@/components/dashboard/dashboard-card";
import { PendingEntryCard } from "@/components/dashboard/pending-entry-card";
import { formatDate } from "@/lib/utils/date";
import type { PendingEntryItem } from "@/hooks/use-dashboard-data";

export type PendingApprovalsSectionProps = {
  canAdmin: boolean;
  pendingEntries: UseQueryResult<PendingEntryItem[], Error>;
  approveEntriesByDate: UseMutationResult<
    { approvedCount: number; invalidCount?: number; date: string },
    Error,
    string,
    unknown
  >;
  rejectEntriesByDate: UseMutationResult<{ rejectedCount: number; date: string }, Error, string, unknown>;
  approveEntry: UseMutationResult<
    { id: string; status: string; averageHoursPerDay: number; currentHours: number },
    Error,
    string,
    unknown
  >;
  rejectEntry: UseMutationResult<{ id: string; status: string }, Error, { entryId: string; reason?: string }, unknown>;
  updateEntry: UseMutationResult<
    { id: string; entryDate: string; hoursRun: number; status: string },
    Error,
    { entryId: string; entryDate?: string; hoursRun?: number },
    unknown
  >;
  deleteEntry: UseMutationResult<{ success: boolean }, Error, string, unknown>;
};

export function PendingApprovalsSection({
  canAdmin,
  pendingEntries,
  approveEntriesByDate,
  rejectEntriesByDate,
  approveEntry,
  rejectEntry,
  updateEntry,
  deleteEntry,
}: PendingApprovalsSectionProps) {
  return (
    <div className="space-y-6">
      {canAdmin ? (
        <Card title="Pending Approvals">
          {pendingEntries.isLoading ? (
            <div className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
              Loading pending entries...
            </div>
          ) : pendingEntries.data && pendingEntries.data.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {pendingEntries.data.length} pending entr{pendingEntries.data.length === 1 ? "y" : "ies"} awaiting
                  approval
                </p>
              </div>
              <div className="max-h-[600px] space-y-4 overflow-y-auto pr-2">
                {Object.entries(
                  pendingEntries.data.reduce<Record<string, PendingEntryItem[]>>((groups, entry) => {
                    const dateKey = entry.entryDate.split("T")[0];
                    if (!groups[dateKey]) groups[dateKey] = [];
                    groups[dateKey].push(entry);
                    return groups;
                  }, {}),
                )
                  .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
                  .map(([dateKey, entriesForDate]) => (
                    <div
                      key={dateKey}
                      className="space-y-3 rounded-xl border border-[var(--color-surface-strong)] bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-[var(--color-text)]">
                            {formatDate(new Date(dateKey))}
                          </p>
                          <p className="text-xs text-[var(--color-text-soft)]">
                            {entriesForDate.length} entr{entriesForDate.length === 1 ? "y" : "ies"} on this day
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (!entriesForDate[0]) return;
                              const entryDateIso = entriesForDate[0].entryDate.split("T")[0];
                              approveEntriesByDate.mutate(entryDateIso, {
                                onSuccess: (result) => {
                                  const invalid = result.invalidCount ?? 0;
                                  const suffix = invalid > 0 ? ` (${invalid} skipped)` : "";
                                  toast.success(
                                    `Approved ${result.approvedCount} entr${result.approvedCount === 1 ? "y" : "ies"} for ${formatDate(new Date(entryDateIso))}${suffix}`,
                                  );
                                },
                                onError: (error) => {
                                  toast.error(
                                    error instanceof Error ? error.message : "Failed to approve entries for this day",
                                  );
                                },
                              });
                            }}
                            disabled={approveEntriesByDate.isPending || rejectEntriesByDate.isPending}
                            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {approveEntriesByDate.isPending ? "Approving..." : "Approve all"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!entriesForDate[0]) return;
                              const entryDateIso = entriesForDate[0].entryDate.split("T")[0];
                              rejectEntriesByDate.mutate(entryDateIso, {
                                onSuccess: (result) => {
                                  toast.success(
                                    `Rejected ${result.rejectedCount} entr${result.rejectedCount === 1 ? "y" : "ies"} for ${formatDate(new Date(entryDateIso))}`,
                                  );
                                },
                                onError: (error) => {
                                  toast.error(
                                    error instanceof Error ? error.message : "Failed to reject entries for this day",
                                  );
                                },
                              });
                            }}
                            disabled={approveEntriesByDate.isPending || rejectEntriesByDate.isPending}
                            className="rounded-lg border-2 border-red-500 bg-white px-4 py-2 text-xs font-bold text-red-500 shadow-lg transition-all hover:scale-[1.02] hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {rejectEntriesByDate.isPending ? "Rejecting..." : "Reject all"}
                          </button>
                        </div>
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
                                  toast.error(
                                    error instanceof Error ? error.message : "Failed to approve entry",
                                  );
                                },
                              });
                            }}
                            onReject={(id, reason) => {
                              rejectEntry.mutate(
                                { entryId: id, reason },
                                {
                                  onSuccess: () => {
                                    toast.success("Entry rejected");
                                  },
                                  onError: (error) => {
                                    toast.error(
                                      error instanceof Error ? error.message : "Failed to reject entry",
                                    );
                                  },
                                },
                              );
                            }}
                            onUpdate={(id, entryDate, hoursRun) => {
                              updateEntry.mutate(
                                { entryId: id, entryDate, hoursRun },
                                {
                                  onSuccess: () => {
                                    toast.success("Entry updated successfully");
                                  },
                                  onError: (error) => {
                                    toast.error(
                                      error instanceof Error ? error.message : "Failed to update entry",
                                    );
                                  },
                                },
                              );
                            }}
                            onDelete={(id) => {
                              deleteEntry.mutate(id, {
                                onSuccess: () => {
                                  toast.success("Entry deleted successfully");
                                },
                                onError: (error) => {
                                  toast.error(
                                    error instanceof Error ? error.message : "Failed to delete entry",
                                  );
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
              <p className="mt-1 text-xs text-[var(--color-text-soft)]">All entries have been reviewed</p>
            </div>
          )}
        </Card>
      ) : (
        <Card title="Pending Approvals">
          <p className="py-8 text-center text-sm font-medium text-[var(--color-text-soft)]">
            Admin access required
          </p>
        </Card>
      )}
    </div>
  );
}
