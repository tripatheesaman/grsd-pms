"use client";

import toast from "react-hot-toast";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { Card } from "@/components/dashboard/dashboard-card";
import { formatDate } from "@/lib/utils/date";
import { apiPath } from "@/lib/config/app-config";
import type { AllEntryItem } from "@/hooks/use-dashboard-data";

export type EntriesReportSectionProps = {
  canAdmin: boolean;
  allEntries: UseQueryResult<AllEntryItem[], Error>;
  entriesReportSearch: string;
  setEntriesReportSearch: (value: string) => void;
  entriesReportStatusFilter: "ALL" | "PENDING" | "APPROVED" | "REJECTED";
  setEntriesReportStatusFilter: (value: "ALL" | "PENDING" | "APPROVED" | "REJECTED") => void;
  entriesReportEquipmentFilter: string;
  setEntriesReportEquipmentFilter: (value: string) => void;
  entriesReportEquipmentFrom: string;
  setEntriesReportEquipmentFrom: (value: string) => void;
  entriesReportEquipmentTo: string;
  setEntriesReportEquipmentTo: (value: string) => void;
  entriesReportDateFrom: string;
  setEntriesReportDateFrom: (value: string) => void;
  entriesReportDateTo: string;
  setEntriesReportDateTo: (value: string) => void;
  equipmentNumberCollator: Intl.Collator;
  onEditEntry: (entry: AllEntryItem) => void;
  onRequestDeleteEntry: (entry: AllEntryItem) => void;
  approveEntry: UseMutationResult<
    { id: string; status: string; averageHoursPerDay: number; currentHours: number },
    Error,
    string,
    unknown
  >;
  rejectEntry: UseMutationResult<{ id: string; status: string }, Error, { entryId: string; reason?: string }, unknown>;
};

export function EntriesReportSection({
  canAdmin,
  allEntries,
  entriesReportSearch,
  setEntriesReportSearch,
  entriesReportStatusFilter,
  setEntriesReportStatusFilter,
  entriesReportEquipmentFilter,
  setEntriesReportEquipmentFilter,
  entriesReportEquipmentFrom,
  setEntriesReportEquipmentFrom,
  entriesReportEquipmentTo,
  setEntriesReportEquipmentTo,
  entriesReportDateFrom,
  setEntriesReportDateFrom,
  entriesReportDateTo,
  setEntriesReportDateTo,
  equipmentNumberCollator,
  onEditEntry,
  onRequestDeleteEntry,
  approveEntry,
  rejectEntry,
}: EntriesReportSectionProps) {
  return (
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
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
                      onChange={(e) =>
                        setEntriesReportStatusFilter(e.target.value as typeof entriesReportStatusFilter)
                      }
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
                      {Array.from(new Map((allEntries.data ?? []).map((e) => [e.equipmentId, e])).values())
                        .sort((a, b) => equipmentNumberCollator.compare(a.equipmentNumber, b.equipmentNumber))
                        .map((entry) => (
                          <option key={entry.equipmentId} value={entry.equipmentId}>
                            {entry.equipmentNumber} - {entry.equipmentName}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">
                      Equipment From
                    </label>
                    <input
                      type="text"
                      value={entriesReportEquipmentFrom}
                      onChange={(e) => setEntriesReportEquipmentFrom(e.target.value)}
                      placeholder="e.g. 1001"
                      className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-soft)]">Equipment To</label>
                    <input
                      type="text"
                      value={entriesReportEquipmentTo}
                      onChange={(e) => setEntriesReportEquipmentTo(e.target.value)}
                      placeholder="e.g. 1010"
                      className="h-9 w-full rounded-lg border-2 border-[var(--color-surface-strong)] bg-white px-3 text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    />
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[var(--color-text-soft)]">
                      Showing{" "}
                      {(() => {
                        const filtered = (allEntries.data ?? []).filter((e) => {
                          if (entriesReportSearch) {
                            const search = entriesReportSearch.toLowerCase();
                            if (
                              !e.equipmentNumber.toLowerCase().includes(search) &&
                              !e.equipmentName.toLowerCase().includes(search)
                            ) {
                              return false;
                            }
                          }
                          return true;
                        });
                        return filtered.length;
                      })()}{" "}
                      of {allEntries.data?.length ?? 0} entries
                    </span>
                    {(entriesReportSearch ||
                      entriesReportStatusFilter !== "ALL" ||
                      entriesReportEquipmentFilter !== "ALL" ||
                      entriesReportEquipmentFrom ||
                      entriesReportEquipmentTo ||
                      entriesReportDateFrom ||
                      entriesReportDateTo) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEntriesReportSearch("");
                          setEntriesReportStatusFilter("ALL");
                          setEntriesReportEquipmentFilter("ALL");
                          setEntriesReportEquipmentFrom("");
                          setEntriesReportEquipmentTo("");
                          setEntriesReportDateFrom("");
                          setEntriesReportDateTo("");
                        }}
                        className="text-xs font-semibold text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent-dark)]"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (entriesReportStatusFilter && entriesReportStatusFilter !== "ALL") {
                          params.set("status", entriesReportStatusFilter);
                        }
                        if (entriesReportEquipmentFilter && entriesReportEquipmentFilter !== "ALL") {
                          params.set("equipmentId", entriesReportEquipmentFilter);
                        }
                        if (entriesReportEquipmentFrom.trim()) {
                          params.set("equipmentFrom", entriesReportEquipmentFrom.trim());
                        }
                        if (entriesReportEquipmentTo.trim()) {
                          params.set("equipmentTo", entriesReportEquipmentTo.trim());
                        }
                        if (entriesReportDateFrom) {
                          params.set("dateFrom", entriesReportDateFrom);
                        }
                        if (entriesReportDateTo) {
                          params.set("dateTo", entriesReportDateTo);
                        }
                        const query = params.toString();
                        const url = apiPath(`/api/entries/export${query ? `?${query}` : ""}`);
                        window.open(url, "_blank");
                      }}
                      className="inline-flex items-center rounded-lg bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] px-3 py-2 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-[600px] space-y-3 overflow-y-auto">
                {(() => {
                  const filtered = (allEntries.data ?? []).filter((e) => {
                    if (entriesReportSearch) {
                      const search = entriesReportSearch.toLowerCase();
                      if (
                        !e.equipmentNumber.toLowerCase().includes(search) &&
                        !e.equipmentName.toLowerCase().includes(search)
                      ) {
                        return false;
                      }
                    }
                    return true;
                  });

                  filtered.sort((a, b) => {
                    const cmp = equipmentNumberCollator.compare(a.equipmentNumber, b.equipmentNumber);
                    if (cmp !== 0) return cmp;
                    return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
                  });

                  return filtered.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm font-medium text-[var(--color-text-soft)]">No entries found</p>
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">Try adjusting your filters</p>
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
                          className="rounded-xl border-2 border-[var(--color-surface-strong)] bg-gradient-to-br from-white to-[var(--color-surface)] p-5 shadow-md transition-all hover:shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <p className="text-base font-bold text-[var(--color-text)]">{entry.equipmentNumber}</p>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusColors[entry.status as keyof typeof statusColors]}`}
                                >
                                  {entry.status}
                                </span>
                                <span className="text-xs font-medium text-[var(--color-text-soft)]">
                                  {entry.equipmentName}
                                </span>
                              </div>
                              <div className="mb-2 grid grid-cols-2 gap-4 text-xs">
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
                                  <p className="font-semibold text-[var(--color-text-soft)]">
                                    {entry.usageUnit === "KM" ? "Equipment total (km)" : "Equipment total hours"}
                                  </p>
                                  <p className="font-bold text-[var(--color-text)]">
                                    {entry.currentEquipmentHours.toFixed(2)}
                                  </p>
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
                                      <p className="font-bold text-[var(--color-text)]">
                                        {entry.approvedAt ? formatDate(entry.approvedAt) : "N/A"}
                                      </p>
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
                                      <p className="font-bold text-[var(--color-text)]">
                                        {entry.rejectedAt ? formatDate(entry.rejectedAt) : "N/A"}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => onEditEntry(entry)}
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
                                          toast.error(
                                            error instanceof Error ? error.message : "Failed to approve entry",
                                          );
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
                                      rejectEntry.mutate(
                                        { entryId: entry.id },
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
                                    className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-3 py-1.5 text-xs font-bold text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => onRequestDeleteEntry(entry)}
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
  );
}
