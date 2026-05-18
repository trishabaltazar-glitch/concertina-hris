import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, ListFilter, Paperclip, XCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { updateLeaveRequestStatus } from "@/app/actions/admin";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

async function ensureLeaveDayBreakdownColumn() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "dayBreakdown" JSONB`);
}

type LeaveRequestWithMeta = {
  id: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
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

function normalizeLeaveBreakdown(value: unknown): LeaveDayBreakdownItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<LeaveDayBreakdownItem>;
    if (typeof candidate.date !== "string") return [];
    if (candidate.dayType !== "FULL_DAY" && candidate.dayType !== "HALF_DAY") return [];

    return [{
      date: candidate.date,
      dayType: candidate.dayType,
      days: candidate.dayType === "HALF_DAY" ? 0.5 : 1,
    }];
  });
}

function getLeaveLabel(leaveType: string) {
  if (leaveType === "LEAVE_CREDITS") return "PFFD Credits";
  return leaveType.replaceAll("_", " ").toLowerCase();
}

function getDateLabel(request: LeaveRequestWithMeta) {
  if (request.dayBreakdown.length === 1) {
    const item = request.dayBreakdown[0];
    return `${format(new Date(`${item.date}T00:00:00`), "MMM d, yyyy")} (${item.dayType === "HALF_DAY" ? "half-day" : "full day"})`;
  }

  if (request.dayBreakdown.length > 1) {
    return `${format(new Date(`${request.dayBreakdown[0].date}T00:00:00`), "MMM d")} to ${format(new Date(`${request.dayBreakdown[request.dayBreakdown.length - 1].date}T00:00:00`), "MMM d, yyyy")}`;
  }

  if (request.dayType === "HALF_DAY") {
    return `${format(request.startDate, "MMM d, yyyy")} (half-day)`;
  }

  return `${format(request.startDate, "MMM d")} to ${format(request.endDate, "MMM d, yyyy")}`;
}

function getBreakdownLabel(request: LeaveRequestWithMeta) {
  if (!request.dayBreakdown.length) return null;

  return request.dayBreakdown
    .map((item) => `${format(new Date(`${item.date}T00:00:00`), "MMM d")} ${item.dayType === "HALF_DAY" ? "half" : "full"}`)
    .join(", ");
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

export default async function AdminLeavesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== "ADMIN" && userRole !== "MANAGER") {
    redirect("/");
  }

  await ensureLeaveDayBreakdownColumn();

  const requests = await prisma.leaveRequest.findMany({
    where: userRole === "ADMIN" ? undefined : { user: { managerId: session.user.id } },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const requestsWithMeta = await Promise.all(
    requests.map(async (request) => {
      const meta = await prisma.$queryRaw<
        { requestedDays: number; dayType: string; dayBreakdown: unknown; attachmentName: string | null }[]
      >`
        SELECT "requestedDays", "dayType", "dayBreakdown", "attachmentName"
        FROM "LeaveRequest"
        WHERE "id" = ${request.id}
        LIMIT 1
      `;

      return {
        ...request,
        requestedDays: meta[0]?.requestedDays || 1,
        dayType: meta[0]?.dayType || "FULL_DAY",
        dayBreakdown: normalizeLeaveBreakdown(meta[0]?.dayBreakdown),
        attachmentName: meta[0]?.attachmentName || null,
      };
    })
  );
  const statusRank: Record<string, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
  requestsWithMeta.sort((a, b) => {
    return (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
  });

  const pendingCount = requestsWithMeta.filter((request) => request.status === "PENDING").length;
  const approvedCount = requestsWithMeta.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = requestsWithMeta.filter((request) => request.status === "REJECTED").length;
  const requestedDays = requestsWithMeta.reduce((sum, request) => sum + request.requestedDays, 0);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Leave
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Leave requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review filed requests and move pending items into approvals.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="w-fit">
          <Link href="/leaves">Employee view</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Requests in view" value={requestsWithMeta.length} helper="Latest 50 requests shown" icon={ListFilter} />
        <Metric label="Pending approvals" value={pendingCount} helper="Waiting for review" icon={Clock3} />
        <Metric label="Approved requests" value={approvedCount} helper={`${rejectedCount} rejected or declined`} icon={CheckCircle2} />
        <Metric label="Days requested" value={requestedDays.toFixed(1).replace(".0", "")} helper="Total days represented" icon={CalendarDays} />
      </div>

      <div className="rounded-lg border border-border bg-background">
        <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Request queue</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending requests stay actionable; processed requests remain visible for context.
            </p>
          </div>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {requestsWithMeta.length} shown
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Employee</th>
                <th className="px-4 py-3 font-semibold">Leave type</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Days</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Recorded</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requestsWithMeta.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No leave requests yet.
                  </td>
                </tr>
              ) : (
                requestsWithMeta.map((request) => (
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
                      {getBreakdownLabel(request) && (
                        <div className="mt-0.5 max-w-xs truncate text-xs" title={getBreakdownLabel(request) || undefined}>
                          {getBreakdownLabel(request)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{request.requestedDays}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{format(request.createdAt, "MMM d, yyyy")}</td>
                    <td className="px-4 py-3">
                      {request.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <form
                            action={async () => {
                              "use server";
                              await updateLeaveRequestStatus(request.id, "APPROVED");
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
                              await updateLeaveRequestStatus(request.id, "REJECTED");
                            }}
                          >
                            <SubmitButton variant="destructive-outline" size="sm" className="h-8 gap-1.5">
                              <XCircle className="size-3.5" />
                              Reject
                            </SubmitButton>
                          </form>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">
                          {format(request.updatedAt, "MMM d, yyyy")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
