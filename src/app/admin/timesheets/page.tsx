import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TimeLogsClientPage } from "./components/time-logs-client-page";
import { format } from "date-fns";
import { closeStaleOpenTimeLogs } from "@/lib/time-log-maintenance";


export const dynamic = "force-dynamic";

const ADMIN_VISIBLE_ROLES = ["ADMIN", "EMPLOYEE", "MANAGER"];

type AdminTimesheetUser = {
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

export default async function AdminTimesheetsPage() {
    const session = await auth();
    const user = session?.user as AdminTimesheetUser | undefined;
    if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        redirect("/login");
    }

    if (user.role === "ADMIN") {
        await closeStaleOpenTimeLogs();
    } else {
        const teamMembers = await prisma.user.findMany({
            where: { managerId: user.id, role: "EMPLOYEE" },
            select: { id: true },
        });

        await closeStaleOpenTimeLogs(teamMembers.map((teamMember) => teamMember.id));
    }

    const timeLogs = await prisma.timeLog.findMany({
        where: user.role === "ADMIN"
            ? { user: { role: { in: ADMIN_VISIBLE_ROLES } } }
            : { user: { managerId: user.id, role: "EMPLOYEE" } },
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    role: true,
                }
            }
        },
        orderBy: { clockIn: "desc" },
        take: 1000, // Show last 1000 logs across the company to allow deep client-side filtering
    });

    const manualRequests = user.role === "ADMIN"
        ? await prisma.$queryRaw<ManualTimeEntryRequest[]>`
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
            LIMIT 50
        `
        : await prisma.$queryRaw<ManualTimeEntryRequest[]>`
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
            LIMIT 50
        `;

    const pendingRequests = manualRequests.filter((request) => request.status === "PENDING").length;
    const recentManualRequests = manualRequests.slice(0, 4).map((request) => ({
        id: request.id,
        userName: request.userName,
        timeLabel: `${format(request.clockIn, "MMM d, h:mm a")} - ${format(request.clockOut, "h:mm a")}`,
        status: request.status,
    }));

    return (
        <TimeLogsClientPage
            initialLogs={timeLogs}
            availableRoles={user.role === "ADMIN" ? ADMIN_VISIBLE_ROLES : ["EMPLOYEE"]}
            manualEntryApprovals={{
                totalRequests: manualRequests.length,
                pendingRequests,
                recentRequests: recentManualRequests,
            }}
        />
    );
}
