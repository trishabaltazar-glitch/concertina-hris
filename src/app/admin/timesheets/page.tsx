import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TimeLogsClientPage } from "./components/time-logs-client-page";
import { addDays, endOfDay, format, isValid, parseISO, startOfDay } from "date-fns";
import { closeStaleOpenTimeLogs } from "@/lib/time-log-maintenance";
import type { Prisma } from "@prisma/client";


export const dynamic = "force-dynamic";

const ADMIN_VISIBLE_ROLES = ["ADMIN", "EMPLOYEE", "MANAGER"];

type AdminTimesheetUser = {
    id: string;
    role: string;
};

type AdminTimesheetsPageProps = {
    searchParams?: Promise<{
        from?: string;
        to?: string;
        status?: string;
        role?: string;
        search?: string;
        page?: string;
    }>;
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

const PAGE_SIZE = 25;
const VALID_STATUSES = new Set(["ON_TIME", "LATE", "FORCED_CHECKOUT"]);

function parseDateParam(value: string | undefined, fallback: Date) {
    if (!value) return fallback;
    const parsed = parseISO(value);
    return isValid(parsed) ? parsed : fallback;
}

function parsePageParam(value: string | undefined) {
    const page = Number.parseInt(value ?? "1", 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function AdminTimesheetsPage({ searchParams }: AdminTimesheetsPageProps) {
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

    const params = await searchParams;
    const availableRoles = user.role === "ADMIN" ? ADMIN_VISIBLE_ROLES : ["EMPLOYEE"];
    const defaultToDate = startOfDay(new Date());
    const defaultFromDate = startOfDay(addDays(defaultToDate, -29));
    const rawFrom = startOfDay(parseDateParam(params?.from, defaultFromDate));
    const rawTo = startOfDay(parseDateParam(params?.to, defaultToDate));
    const selectedFrom = rawTo < rawFrom ? rawTo : rawFrom;
    const selectedTo = endOfDay(rawTo < rawFrom ? rawFrom : rawTo);
    const statusFilter = params?.status && VALID_STATUSES.has(params.status) ? params.status : "ALL";
    const roleFilter = params?.role && availableRoles.includes(params.role) ? params.role : "ALL";
    const searchQuery = (params?.search ?? "").trim();
    const page = parsePageParam(params?.page);

    const scopedUserWhere: Prisma.UserWhereInput = user.role === "ADMIN"
        ? { role: { in: ADMIN_VISIBLE_ROLES } }
        : { managerId: user.id, role: "EMPLOYEE" };

    const timeLogWhere: Prisma.TimeLogWhereInput = {
        clockIn: {
            gte: selectedFrom,
            lte: selectedTo,
        },
        user: {
            ...scopedUserWhere,
            ...(roleFilter === "ALL" ? {} : { role: roleFilter }),
            ...(searchQuery
                ? {
                    OR: [
                        { name: { contains: searchQuery, mode: "insensitive" } },
                        { email: { contains: searchQuery, mode: "insensitive" } },
                    ],
                }
                : {}),
        },
        ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
    };

    const [timeLogs, totalLogs] = await Promise.all([
        prisma.timeLog.findMany({
            where: timeLogWhere,
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
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
        }),
        prisma.timeLog.count({ where: timeLogWhere }),
    ]);

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
            key={`${searchQuery}-${statusFilter}-${roleFilter}-${format(selectedFrom, "yyyy-MM-dd")}-${format(selectedTo, "yyyy-MM-dd")}-${page}`}
            initialLogs={timeLogs}
            availableRoles={availableRoles}
            pagination={{
                page,
                pageSize: PAGE_SIZE,
                totalLogs,
            }}
            initialFilters={{
                search: searchQuery,
                status: statusFilter,
                role: roleFilter,
                from: selectedFrom,
                to: selectedTo,
            }}
            manualEntryApprovals={{
                totalRequests: manualRequests.length,
                pendingRequests,
                recentRequests: recentManualRequests,
            }}
        />
    );
}
