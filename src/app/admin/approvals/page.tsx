import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Clock3, ListFilter, Timer, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { updateManualTimeEntryRequestStatus } from "@/app/actions/admin";
import AdminLeavesPage from "@/app/admin/leaves/page";
import AdminOvertimePage from "@/app/admin/overtime/page";
import { type ApprovalTab, ApprovalsTabs } from "@/app/admin/approvals/approvals-tabs";
import { SubmitButton } from "@/components/ui/submit-button";
import { TableSearchPagination } from "@/components/table/table-search-pagination";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APPROVAL_TABS = ["pffd", "ot", "manual-entry"] as const;

type AdminUser = {
  id: string;
  role: string;
};

type ManualTimeEntryRequest = {
  id: string;
  clockIn: Date;
  clockOut: Date;
  reason: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  userName: string;
  userEmail: string;
};

function getActiveTab(tab?: string): ApprovalTab {
  return APPROVAL_TABS.includes(tab as ApprovalTab) ? (tab as ApprovalTab) : "pffd";
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

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

function getManualEntryHours(request: ManualTimeEntryRequest) {
  return Math.max(0, (request.clockOut.getTime() - request.clockIn.getTime()) / (1000 * 60 * 60));
}

function getReviewedDateLabel(reviewedAt: Date | null) {
  return reviewedAt ? format(reviewedAt, "MMM d, yyyy") : "-";
}

function ApprovalPanelError({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <h2 className="mt-3 font-semibold text-foreground">{label} could not be loaded</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        The database connection is temporarily unavailable. Refresh the page after the connection recovers.
      </p>
    </div>
  );
}

async function safePanel(label: string, load: () => Promise<ReactNode>) {
  try {
    return await load();
  } catch (error) {
    console.error(`Failed to load ${label} approvals panel:`, error);
    return <ApprovalPanelError label={label} />;
  }
}

async function loadManualEntryRequests(user: AdminUser) {
  return user.role === "ADMIN"
    ? prisma.$queryRaw<ManualTimeEntryRequest[]>`
        SELECT
          ter."id",
          ter."clockIn",
          ter."clockOut",
          ter."reason",
          ter."status",
          ter."createdAt",
          ter."reviewedAt",
          u."name" as "userName",
          u."email" as "userEmail"
        FROM "TimeEntryRequest" ter
        INNER JOIN "User" u ON u."id" = ter."userId"
        WHERE u."role" IN ('EMPLOYEE', 'MANAGER')
        ORDER BY
          CASE WHEN ter."status" = 'PENDING' THEN 0 ELSE 1 END,
          ter."createdAt" DESC
        LIMIT 100
      `
    : prisma.$queryRaw<ManualTimeEntryRequest[]>`
        SELECT
          ter."id",
          ter."clockIn",
          ter."clockOut",
          ter."reason",
          ter."status",
          ter."createdAt",
          ter."reviewedAt",
          u."name" as "userName",
          u."email" as "userEmail"
        FROM "TimeEntryRequest" ter
        INNER JOIN "User" u ON u."id" = ter."userId"
        WHERE u."managerId" = ${user.id}
          AND u."role" = 'EMPLOYEE'
        ORDER BY
          CASE WHEN ter."status" = 'PENDING' THEN 0 ELSE 1 END,
          ter."createdAt" DESC
        LIMIT 100
      `;
}

async function ManualEntryApprovalsPanel({ user }: { user: AdminUser }) {
  const manualRequests = await loadManualEntryRequests(user);
  const pendingRequests = manualRequests.filter((request) => request.status === "PENDING").length;
  const approvedRequests = manualRequests.filter((request) => request.status === "APPROVED").length;
  const rejectedRequests = manualRequests.filter((request) => request.status === "REJECTED").length;
  const requestedHours = manualRequests.reduce((sum, request) => sum + getManualEntryHours(request), 0);

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Requests in view" value={manualRequests.length} helper="Latest 100 requests shown" icon={ListFilter} />
        <Metric label="Pending approvals" value={pendingRequests} helper="Waiting for review" icon={Clock3} />
        <Metric label="Approved requests" value={approvedRequests} helper={`${rejectedRequests} rejected or declined`} icon={CheckCircle2} />
        <Metric label="Hours requested" value={requestedHours.toFixed(1).replace(".0", "")} helper="Total manual hours represented" icon={Timer} />
      </div>

      <section className="rounded-lg border border-border bg-background">
        <TableSearchPagination tableId="manual-entry-approvals-table" itemLabel="manual entry requests" />

        <div className="overflow-x-auto">
          <table id="manual-entry-approvals-table" className="w-full min-w-[1020px] text-left text-sm">
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
              {manualRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No manual entry requests yet.
                  </td>
                </tr>
              ) : (
                manualRequests.map((request) => (
                  <tr
                    key={request.id}
                    data-table-row
                    data-status={request.status}
                    className="align-top transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{request.userName}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p className="font-medium text-foreground">{format(request.clockIn, "MMM d, yyyy")}</p>
                      <p className="mt-0.5 text-xs">
                        {format(request.clockIn, "h:mm a")} - {format(request.clockOut, "h:mm a")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="max-w-sm truncate text-muted-foreground" title={request.reason || undefined}>
                        {request.reason || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{format(request.createdAt, "MMM d, yyyy")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{getReviewedDateLabel(request.reviewedAt)}</td>
                    <td className="px-4 py-3">
                      {request.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <form
                            action={async () => {
                              "use server";
                              await updateManualTimeEntryRequestStatus(request.id, "APPROVED");
                            }}
                          >
                            <SubmitButton variant="success" size="sm" className="h-8 gap-1.5">
                              <CheckCircle2 className="size-3.5" />
                              Approve
                            </SubmitButton>
                          </form>
                          <form
                            action={async () => {
                              "use server";
                              await updateManualTimeEntryRequestStatus(request.id, "REJECTED");
                            }}
                          >
                            <SubmitButton variant="destructive-outline" size="sm" className="h-8 gap-1.5">
                              <XCircle className="size-3.5" />
                              Reject
                            </SubmitButton>
                          </form>
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

export default async function AdminApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const user = session?.user as AdminUser | undefined;

  if (!user?.id || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    redirect("/");
  }

  const params = await searchParams;
  const activeTab = getActiveTab(params?.tab);

  const pffdPanel = await safePanel("PFFD", () => AdminLeavesPage());
  const overtimePanel = await safePanel("OT", () => AdminOvertimePage());
  const manualEntryPanel = await safePanel("Manual entry", () => ManualEntryApprovalsPanel({ user }));

  return (
    <ApprovalsTabs
      activeTab={activeTab}
      panels={{
        pffd: pffdPanel,
        ot: overtimePanel,
        "manual-entry": manualEntryPanel,
      }}
    />
  );
}
