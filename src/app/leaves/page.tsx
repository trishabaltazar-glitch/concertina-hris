import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LeavesClientPage } from "@/app/leaves/components/leaves-client-page";


export default async function LeavesPage() {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        redirect("/login");
    }

    const employeeId = session.user.id;

    const leaveRequests = await prisma.$queryRaw<{
        id: string;
        leaveType: string;
        startDate: Date;
        endDate: Date;
        dayType: string;
        requestedDays: number;
        attachmentName: string | null;
        reason: string | null;
        status: string;
        createdAt: Date;
    }[]>`
        SELECT "id", "leaveType", "startDate", "endDate", "dayType", "requestedDays", "attachmentName", "reason", "status", "createdAt"
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
                attachmentName: request.attachmentName,
                reason: request.reason,
                status: request.status,
                createdAt: request.createdAt.toISOString(),
            }))}
        />
    );
}
