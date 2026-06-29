"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, ListFilter, Paperclip } from "lucide-react";

import { updateLeaveRequestStatus } from "@/app/actions/admin";
import { ApprovalTableControls } from "@/app/admin/approvals/approval-table-controls";
import { OptimisticReviewButton } from "@/app/admin/approvals/optimistic-review-button";
import { cn } from "@/lib/utils";

type ReviewStatus = "APPROVED" | "REJECTED";

export type PffdApprovalRow = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  requestedDays: number;
  dayType: string;
  dayBreakdown: LeaveDayBreakdownItem[];
  attachmentName: string | null;
  user: {
    name: string;
    email: string;
  };
};

type LeaveDayBreakdownItem = {
  date: string;
  dayType: "FULL_DAY" | "HALF_DAY";
  days: number;
};

function Metric({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
      </div>
      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", styles)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function getLeaveLabel(leaveType: string) {
  if (leaveType === "LEAVE_CREDITS") return "PFFD Credits";
  return leaveType.replaceAll("_", " ").toLowerCase();
}

function getDateLabel(request: PffdApprovalRow) {
  if (request.dayBreakdown.length === 1) {
    const item = request.dayBreakdown[0];
    return `${format(new Date(`${item.date}T00:00:00`), "MMM d, yyyy")} (${item.dayType === "HALF_DAY" ? "half-day" : "full day"})`;
  }

  if (request.dayBreakdown.length > 1) {
    return `${format(new Date(`${request.dayBreakdown[0].date}T00:00:00`), "MMM d")} to ${format(new Date(`${request.dayBreakdown[request.dayBreakdown.length - 1].date}T00:00:00`), "MMM d, yyyy")}`;
  }

  if (request.dayType === "HALF_DAY") {
    return `${format(new Date(request.startDate), "MMM d, yyyy")} (half-day)`;
  }

  return `${format(new Date(request.startDate), "MMM d")} to ${format(new Date(request.endDate), "MMM d, yyyy")}`;
}

function getBreakdownLabel(request: PffdApprovalRow) {
  if (!request.dayBreakdown.length) return null;

  return request.dayBreakdown
    .map((item) => `${format(new Date(`${item.date}T00:00:00`), "MMM d")} ${item.dayType === "HALF_DAY" ? "half" : "full"}`)
    .join(", ");
}

function getReviewedDateLabel(request: PffdApprovalRow) {
  return request.status === "PENDING" ? "-" : format(new Date(request.updatedAt), "MMM d, yyyy");
}

function getSearchText(request: PffdApprovalRow) {
  return [
    request.user.name,
    request.user.email,
    request.leaveType,
    getLeaveLabel(request.leaveType),
    getDateLabel(request),
    request.reason,
    request.status,
  ].filter(Boolean).join(" ").toLowerCase();
}

export function PffdApprovalsClient({ initialRequests }: { initialRequests: PffdApprovalRow[] }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const [status, setStatus] = useState("ALL");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const matchesStatus = status === "ALL" || request.status === status;
      const matchesQuery = !deferredQuery || getSearchText(request).includes(deferredQuery);
      return matchesStatus && matchesQuery;
    });
  }, [deferredQuery, requests, status]);

  const visibleRequests = filteredRequests.slice((page - 1) * pageSize, page * pageSize);
  const pendingCount = requests.filter((request) => request.status === "PENDING").length;
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = requests.filter((request) => request.status === "REJECTED").length;
  const requestedDays = requests.reduce((sum, request) => sum + request.requestedDays, 0);

  async function reviewRequest(requestId: string, nextStatus: ReviewStatus) {
    const previousRequests = requests;
    setError(null);
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? { ...request, status: nextStatus, updatedAt: new Date().toISOString() }
          : request
      )
    );

    const result = await updateLeaveRequestStatus(requestId, nextStatus);
    if (!result.success) {
      setRequests(previousRequests);
      setError(result.error || "Could not update request.");
      return result;
    }

    startRefresh(() => router.refresh());
    return result;
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Requests in view" value={requests.length} helper="Latest 50 requests shown" icon={ListFilter} />
        <Metric label="Pending approvals" value={pendingCount} helper="Waiting for review" icon={Clock3} />
        <Metric label="Approved requests" value={approvedCount} helper={`${rejectedCount} rejected or declined`} icon={CheckCircle2} />
        <Metric label="Days requested" value={requestedDays.toFixed(1).replace(".0", "")} helper="Total days represented" icon={CalendarDays} />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border bg-background">
        <ApprovalTableControls
          itemLabel="PFFD requests"
          query={query}
          status={status}
          page={page}
          pageSize={pageSize}
          totalItems={filteredRequests.length}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Leave type</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Days</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date submitted</th>
                <th className="px-4 py-3 font-semibold">Date approved/rejected</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((request) => {
                  const breakdownLabel = getBreakdownLabel(request);

                  return (
                    <tr key={request.id} className="align-top transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{request.user.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{request.user.email}</p>
                      </td>
                      <td className="px-4 py-3 capitalize text-foreground">
                        <div className="flex items-center gap-2">
                          {getLeaveLabel(request.leaveType)}
                          {request.attachmentName && (
                            <Link
                              href={`/leaves/attachments/${request.id}`}
                              className="text-muted-foreground hover:text-foreground"
                              title="View attachment"
                            >
                              <Paperclip className="size-3.5" />
                            </Link>
                          )}
                        </div>
                        {request.reason && (
                          <p className="mt-1 max-w-xs truncate text-xs normal-case text-muted-foreground" title={request.reason}>
                            {request.reason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div>{getDateLabel(request)}</div>
                        {breakdownLabel && (
                          <div className="mt-0.5 max-w-xs truncate text-xs" title={breakdownLabel}>
                            {breakdownLabel}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{request.requestedDays}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(new Date(request.createdAt), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getReviewedDateLabel(request)}</td>
                      <td className="px-4 py-3">
                        {request.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <OptimisticReviewButton status="APPROVED" onReview={(nextStatus) => reviewRequest(request.id, nextStatus)} />
                            <OptimisticReviewButton status="REJECTED" onReview={(nextStatus) => reviewRequest(request.id, nextStatus)} />
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
