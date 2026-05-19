import { format } from "date-fns";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { updateManualTimeEntryRequestStatus } from "@/app/actions/admin";
import AdminLeavesPage from "@/app/admin/leaves/page";
import AdminOvertimePage from "@/app/admin/overtime/page";
import { type ApprovalTab, ApprovalsTabs } from "@/app/admin/approvals/approvals-tabs";
import { SubmitButton } from "@/components/ui/submit-button";
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

  return (
    <section className="rounded-lg border border-border bg-background">
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Manual time entry approvals</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Review submitted manual entry requests before they become time logs.
          </p>
        </div>
        <span className="w-fit rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {pendingRequests} pending
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Requested time</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {manualRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No manual entry requests yet.
                </td>
              </tr>
            ) : (
              manualRequests.map((request) => (
                <tr key={request.id} className="align-top transition-colors hover:bg-muted/30">
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
