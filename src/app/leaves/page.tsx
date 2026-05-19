import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LeavesClientPage } from "@/app/leaves/components/leaves-client-page";

type LeaveDayBreakdownItem = {
    date: string;
    dayType: "FULL_DAY" | "HALF_DAY";
    days: number;
};

function normalizeLeaveBreakdown(value: unknown): LeaveDayBreakdownItem[] | null {
    if (!Array.isArray(value)) return null;

    const items = value.flatMap((item) => {
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

    return items.length ? items : null;
}

async function ensureLeaveDayBreakdownColumn() {
    // Managed by Prisma migration 20260519010000_add_leave_day_breakdown.
}

export default async function LeavesPage() {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        redirect("/login");
    }

    const employeeId = session.user.id;
    await ensureLeaveDayBreakdownColumn();

    const leaveRequests = await prisma.$queryRaw<{
        id: string;
        leaveType: string;
        startDate: Date;
        endDate: Date;
        dayType: string;
        requestedDays: number;
        dayBreakdown: unknown;
        attachmentName: string | null;
        reason: string | null;
        status: string;
        createdAt: Date;
    }[]>`
        SELECT "id", "leaveType", "startDate", "endDate", "dayType", "requestedDays", "dayBreakdown", "attachmentName", "reason", "status", "createdAt"
        FROM "LeaveRequest"
        WHERE "userId" = ${employeeId}
        ORDER BY "createdAt" DESC
    `;

    const balances = await prisma.leaveBalance.findMany({
        where: { userId: employeeId },
    });

    return (
        <LeavesClientPage
            balances={balances.map((balance) => ({
                id: balance.id,
                leaveType: balance.leaveType,
                balance: balance.balance,
            }))}
            leaveRequests={leaveRequests.map((request) => ({
                id: request.id,
                leaveType: request.leaveType,
                startDate: request.startDate.toISOString(),
                endDate: request.endDate.toISOString(),
                dayType: request.dayType,
                requestedDays: request.requestedDays,
                dayBreakdown: normalizeLeaveBreakdown(request.dayBreakdown),
                attachmentName: request.attachmentName,
                reason: request.reason,
                status: request.status,
                createdAt: request.createdAt.toISOString(),
            }))}
        />
    );
}
