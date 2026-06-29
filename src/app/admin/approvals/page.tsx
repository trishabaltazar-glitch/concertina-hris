import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import AdminLeavesPage from "@/app/admin/leaves/page";
import AdminOvertimePage from "@/app/admin/overtime/page";
import { ManualEntryApprovalsClient, type ManualEntryApprovalRow } from "@/app/admin/approvals/manual-entry-approvals-client";
import { type ApprovalTab, ApprovalsTabs } from "@/app/admin/approvals/approvals-tabs";
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
  const clientRows: ManualEntryApprovalRow[] = manualRequests.map((request) => ({
    id: request.id,
    clockIn: request.clockIn.toISOString(),
    clockOut: request.clockOut.toISOString(),
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    userName: request.userName,
    userEmail: request.userEmail,
  }));

  return <ManualEntryApprovalsClient initialRequests={clientRows} />;
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
  const activePanel =
    activeTab === "ot"
      ? await safePanel("OT", () => AdminOvertimePage())
      : activeTab === "manual-entry"
        ? await safePanel("Manual entry", () => ManualEntryApprovalsPanel({ user }))
        : await safePanel("PFFD", () => AdminLeavesPage());

  return (
    <ApprovalsTabs
      activeTab={activeTab}
      panel={activePanel}
    />
  );
}
