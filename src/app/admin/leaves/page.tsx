import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PffdApprovalsClient, type PffdApprovalRow } from "@/app/admin/leaves/pffd-approvals-client";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ADMIN_VISIBLE_ROLES = ["EMPLOYEE", "MANAGER"];

async function ensureLeaveDayBreakdownColumn() {
  // Managed by Prisma migration 20260519010000_add_leave_day_breakdown.
}

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
    where: userRole === "ADMIN"
      ? { user: { role: { in: ADMIN_VISIBLE_ROLES } } }
      : { user: { managerId: session.user.id, role: "EMPLOYEE" } },
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

  const requestsWithMeta = requests.map((request) => ({
    ...request,
    requestedDays: request.requestedDays || 1,
    dayType: request.dayType || "FULL_DAY",
    dayBreakdown: normalizeLeaveBreakdown(request.dayBreakdown),
    attachmentName: request.attachmentName || null,
  }));
  const statusRank: Record<string, number> = { PENDING: 0, APPROVED: 1, REJECTED: 2 };
  requestsWithMeta.sort((a, b) => {
    return (statusRank[a.status] ?? 3) - (statusRank[b.status] ?? 3);
  });

  const clientRows: PffdApprovalRow[] = requestsWithMeta.map((request) => ({
    id: request.id,
    leaveType: request.leaveType,
    startDate: request.startDate.toISOString(),
    endDate: request.endDate.toISOString(),
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    requestedDays: request.requestedDays,
    dayType: request.dayType,
    dayBreakdown: request.dayBreakdown,
    attachmentName: request.attachmentName,
    user: request.user,
  }));

  return <PffdApprovalsClient initialRequests={clientRows} />;
}
