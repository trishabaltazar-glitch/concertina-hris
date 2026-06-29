"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CheckCircle2, Clock3, ListFilter, Timer } from "lucide-react";

import { updateManualTimeEntryRequestStatus } from "@/app/actions/admin";
import { ApprovalTableControls } from "@/app/admin/approvals/approval-table-controls";
import { OptimisticReviewButton } from "@/app/admin/approvals/optimistic-review-button";
import { cn } from "@/lib/utils";

type ReviewStatus = "APPROVED" | "REJECTED";

export type ManualEntryApprovalRow = {
  id: string;
  clockIn: string;
  clockOut: string;
  reason: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  userName: string;
  userEmail: string;
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

  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", styles)}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function getManualEntryHours(request: ManualEntryApprovalRow) {
  return Math.max(0, (new Date(request.clockOut).getTime() - new Date(request.clockIn).getTime()) / (1000 * 60 * 60));
}

function getReviewedDateLabel(reviewedAt: string | null) {
  return reviewedAt ? format(new Date(reviewedAt), "MMM d, yyyy") : "-";
}

function getSearchText(request: ManualEntryApprovalRow) {
  return [
    request.userName,
    request.userEmail,
    request.reason,
    request.status,
    format(new Date(request.clockIn), "MMM d, yyyy h:mm a"),
    format(new Date(request.clockOut), "h:mm a"),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function ManualEntryApprovalsClient({ initialRequests }: { initialRequests: ManualEntryApprovalRow[] }) {
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
  const pendingRequests = requests.filter((request) => request.status === "PENDING").length;
  const approvedRequests = requests.filter((request) => request.status === "APPROVED").length;
  const rejectedRequests = requests.filter((request) => request.status === "REJECTED").length;
  const requestedHours = requests.reduce((sum, request) => sum + getManualEntryHours(request), 0);

  async function reviewRequest(requestId: string, nextStatus: ReviewStatus) {
    const previousRequests = requests;
    setError(null);
    setRequests((current) =>
      current.map((request) =>
        request.id === requestId
          ? { ...request, status: nextStatus, reviewedAt: new Date().toISOString() }
          : request
      )
    );

    const result = await updateManualTimeEntryRequestStatus(requestId, nextStatus);
    if (!result.success) {
      setRequests(previousRequests);
      setError(result.error || "Could not update manual entry request.");
      return result;
    }

    startRefresh(() => router.refresh());
    return result;
  }

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Requests in view" value={requests.length} helper="Latest 100 requests shown" icon={ListFilter} />
        <Metric label="Pending approvals" value={pendingRequests} helper="Waiting for review" icon={Clock3} />
        <Metric label="Approved requests" value={approvedRequests} helper={`${rejectedRequests} rejected or declined`} icon={CheckCircle2} />
        <Metric label="Hours requested" value={requestedHours.toFixed(1).replace(".0", "")} helper="Total manual hours represented" icon={Timer} />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-border bg-background">
        <ApprovalTableControls
          itemLabel="manual entry requests"
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
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Requested time</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date submitted</th>
                <th className="px-4 py-3 font-semibold">Date approved/rejected</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No manual entry requests found.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((request) => (
                  <tr key={request.id} className="align-top transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{request.userName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p className="font-medium text-foreground">{format(new Date(request.clockIn), "MMM d, yyyy")}</p>
                      <p className="mt-0.5 text-xs">
                        {format(new Date(request.clockIn), "h:mm a")} - {format(new Date(request.clockOut), "h:mm a")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-sm truncate text-muted-foreground" title={request.reason || undefined}>
                        {request.reason || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{format(new Date(request.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getReviewedDateLabel(request.reviewedAt)}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
