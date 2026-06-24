"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/auth"; // import the auth module
import { createNotifications } from "@/lib/notifications";


function cleanOptionalText(value?: string) {
    const cleaned = value?.trim();
    return cleaned ? cleaned.slice(0, 500) : null;
}

type ClockStatus = {
    isClockedIn: boolean;
    clockInTime: Date | null;
};

function emptyClockStatus(): ClockStatus {
    return {
        isClockedIn: false,
        clockInTime: null,
    };
}

function buildClockStatus(activeLog: { clockIn: Date } | null): ClockStatus {
    return {
        isClockedIn: !!activeLog,
        clockInTime: activeLog?.clockIn || null,
    };
}

function parseManualEntryDate(date: FormDataEntryValue | null, time: FormDataEntryValue | null) {
    const dateValue = typeof date === "string" ? date : "";
    const timeValue = typeof time === "string" ? time : "";

    if (!dateValue || !timeValue) return null;

    const parsed = new Date(`${dateValue}T${timeValue}:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function getAssignedHolidayForDate(userId: string, date: Date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const holidays = await prisma.$queryRaw<{ name: string }[]>`
        SELECT "name"
        FROM "HolidayAssignment"
        WHERE "userId" = ${userId}
          AND "date" >= ${dayStart}
          AND "date" <= ${dayEnd}
        LIMIT 1
    `;

    return holidays[0] || null;
}

export async function toggleClockStatus(projectName?: string, notes?: string) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
        }

        const employeeId = session.user.id;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

        // 1. Check if the user has an active (open) time log
        const activeLog = await prisma.timeLog.findFirst({
            where: {
                userId: employeeId,
                clockOut: null,
            },
            orderBy: {
                clockIn: "desc",
            },
        });

        if (activeLog) {
            // Did they forget to clock out yesterday?
            if (activeLog.clockIn < startOfToday) {
                // Force close yesterday's log at 23:59:59
                const endOfYesterday = new Date(startOfToday.getTime() - 1);
                await prisma.timeLog.update({
                    where: { id: activeLog.id },
                    data: { clockOut: endOfYesterday, status: "FORCED_CHECKOUT" },
                });
                
                await prisma.auditLog.create({
                    data: { action: "FORCED_CLOCK_OUT", userId: employeeId, details: "System forcefully closed stale time log from previous day." }
                });
                // We let it continue below to create their new clock-in for today!
            } else {
                // Normal clock out for today
                const clockOutTime = new Date();
                await prisma.timeLog.update({
                    where: { id: activeLog.id },
                    data: { clockOut: clockOutTime },
                });

                await prisma.auditLog.create({
                    data: { action: "CLOCK_OUT", userId: employeeId, details: "User clocked out." }
                });

                revalidatePath("/");
                return { success: true, status: emptyClockStatus() };
            }
        }

        // 2. User is clocking in (either standard, or after an auto-checkout)
        const assignedHoliday = await getAssignedHolidayForDate(employeeId, now);
        if (assignedHoliday) {
            return {
                success: false,
                error: `${assignedHoliday.name} is assigned as a holiday. You do not need to clock in today.`,
            };
        }

        const clockInTime = new Date();
        const startOfDay = new Date(clockInTime.getFullYear(), clockInTime.getMonth(), clockInTime.getDate(), 9, 0, 0);
        const isLate = clockInTime > startOfDay;

        const timeLog = await prisma.timeLog.create({
            data: {
                userId: employeeId,
                clockIn: clockInTime,
                status: isLate ? "LATE" : "ON_TIME",
                projectName: cleanOptionalText(projectName),
                notes: cleanOptionalText(notes),
            },
        });

        await prisma.auditLog.create({
            data: { action: "CLOCK_IN", userId: employeeId, details: isLate ? "Late Clock In" : "On-Time Clock In" }
        });

        // Refresh the dashboard data
        revalidatePath("/");

        return { success: true, status: buildClockStatus({ clockIn: timeLog.clockIn }) };
    } catch (error) {
        console.error("Error toggling clock status:", error);
        return { success: false, error: "Failed to update time log" };
    }
}

export async function deleteOwnTimeLog(timeLogId: string) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
        }

        const timeLog = await prisma.timeLog.findFirst({
            where: {
                id: timeLogId,
                userId: session.user.id,
            },
            select: {
                id: true,
                clockIn: true,
            },
        });

        if (!timeLog) {
            return { success: false, error: "Time log not found." };
        }

        await prisma.timeLog.delete({
            where: { id: timeLog.id },
        });

        await prisma.auditLog.create({
            data: {
                action: "TIME_LOG_DELETED",
                userId: session.user.id,
                details: `User deleted time log from ${timeLog.clockIn.toISOString()}.`,
            },
        });

        revalidatePath("/");
        revalidatePath("/timesheets");
        revalidatePath("/admin/timesheets");

        return { success: true };
    } catch (error) {
        console.error("Error deleting time log:", error);
        return { success: false, error: "Failed to delete time log" };
    }
}

export async function submitManualTimeEntryRequest(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const clockIn = parseManualEntryDate(formData.get("date"), formData.get("clockIn"));
        const clockOut = parseManualEntryDate(formData.get("date"), formData.get("clockOut"));
        const reason = cleanOptionalText(String(formData.get("reason") || ""));

        if (!clockIn || !clockOut) {
            return { success: false, error: "Enter a valid date, clock-in, and clock-out time." };
        }

        if (clockOut <= clockIn) {
            return { success: false, error: "Clock-out must be later than clock-in." };
        }

        if (clockIn > new Date()) {
            return { success: false, error: "Manual entries cannot be requested for future time." };
        }

        if (!reason) {
            return { success: false, error: "Add a short reason for the manual entry request." };
        }

        const overlappingLogs = await prisma.timeLog.count({
            where: {
                userId: session.user.id,
                clockIn: { lt: clockOut },
                clockOut: { gt: clockIn },
            },
        });

        if (overlappingLogs > 0) {
            return { success: false, error: "This request overlaps an existing time log." };
        }

        const duplicatePending = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint as count
            FROM "TimeEntryRequest"
            WHERE "userId" = ${session.user.id}
              AND "status" = 'PENDING'
              AND "clockIn" < ${clockOut}
              AND "clockOut" > ${clockIn}
        `;

        if (Number(duplicatePending[0]?.count || 0) > 0) {
            return { success: false, error: "This request overlaps a pending manual entry request." };
        }

        await prisma.$executeRaw`
            INSERT INTO "TimeEntryRequest" (
                "id",
                "userId",
                "clockIn",
                "clockOut",
                "reason",
                "status",
                "createdAt",
                "updatedAt"
            )
            VALUES (
                ${randomUUID()},
                ${session.user.id},
                ${clockIn},
                ${clockOut},
                ${reason},
                'PENDING',
                ${new Date()},
                ${new Date()}
            )
        `;

        const employee = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { name: true, managerId: true },
        });
        const admins = await prisma.user.findMany({
            where: {
                OR: [
                    { role: "ADMIN" },
                    ...(employee?.managerId ? [{ id: employee.managerId }] : []),
                ],
            },
            select: { id: true },
        });

        await createNotifications(
            admins.map((admin) => ({
                userId: admin.id,
                title: "Manual time entry request",
                message: `${employee?.name || "An employee"} requested a manual time entry.`,
                href: "/admin/timesheets",
                type: "TIME_ENTRY_REQUEST",
            }))
        );

        await prisma.auditLog.create({
            data: {
                action: "TIME_ENTRY_REQUESTED",
                userId: session.user.id,
                details: `Manual entry requested from ${clockIn.toISOString()} to ${clockOut.toISOString()}.`,
            },
        });

        revalidatePath("/timesheets");
        revalidatePath("/admin/timesheets");
        revalidatePath("/notifications");

        return { success: true };
    } catch (error) {
        console.error("Error submitting manual time entry request:", error);
        return { success: false, error: "Failed to submit manual time entry request." };
    }
}

export async function updatePendingManualTimeEntryRequest(requestId: string, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const clockIn = parseManualEntryDate(formData.get("date"), formData.get("clockIn"));
        const clockOut = parseManualEntryDate(formData.get("date"), formData.get("clockOut"));
        const reason = cleanOptionalText(String(formData.get("reason") || ""));

        if (!clockIn || !clockOut) {
            return { success: false, error: "Enter a valid date, clock-in, and clock-out time." };
        }

        if (clockOut <= clockIn) {
            return { success: false, error: "Clock-out must be later than clock-in." };
        }

        if (clockIn > new Date()) {
            return { success: false, error: "Manual entries cannot be requested for future time." };
        }

        if (!reason) {
            return { success: false, error: "Add a short reason for the manual entry request." };
        }

        const existing = await prisma.$queryRaw<{ id: string }[]>`
            SELECT "id"
            FROM "TimeEntryRequest"
            WHERE "id" = ${requestId}
              AND "userId" = ${session.user.id}
              AND "status" = 'PENDING'
            LIMIT 1
        `;

        if (!existing[0]) {
            return { success: false, error: "Only pending manual entry requests can be edited." };
        }

        const overlappingLogs = await prisma.timeLog.count({
            where: {
                userId: session.user.id,
                clockIn: { lt: clockOut },
                clockOut: { gt: clockIn },
            },
        });

        if (overlappingLogs > 0) {
            return { success: false, error: "This request overlaps an existing time log." };
        }

        const duplicatePending = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*)::bigint as count
            FROM "TimeEntryRequest"
            WHERE "userId" = ${session.user.id}
              AND "status" = 'PENDING'
              AND "id" <> ${requestId}
              AND "clockIn" < ${clockOut}
              AND "clockOut" > ${clockIn}
        `;

        if (Number(duplicatePending[0]?.count || 0) > 0) {
            return { success: false, error: "This request overlaps another pending manual entry request." };
        }

        await prisma.$executeRaw`
            UPDATE "TimeEntryRequest"
            SET
                "clockIn" = ${clockIn},
                "clockOut" = ${clockOut},
                "reason" = ${reason},
                "updatedAt" = ${new Date()}
            WHERE "id" = ${requestId}
              AND "userId" = ${session.user.id}
              AND "status" = 'PENDING'
        `;

        await prisma.auditLog.create({
            data: {
                action: "TIME_ENTRY_REQUEST_UPDATED",
                userId: session.user.id,
                details: `Updated pending manual entry request ${requestId}.`,
            },
        });

        revalidatePath("/timesheets");
        revalidatePath("/admin/timesheets");
        return { success: true };
    } catch (error) {
        console.error("Error updating manual time entry request:", error);
        return { success: false, error: "Failed to update manual time entry request." };
    }
}

export async function cancelPendingManualTimeEntryRequest(requestId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const requests = await prisma.$queryRaw<{ id: string; userName: string }[]>`
            SELECT ter."id", u."name" as "userName"
            FROM "TimeEntryRequest" ter
            INNER JOIN "User" u ON u."id" = ter."userId"
            WHERE ter."id" = ${requestId}
              AND ter."userId" = ${session.user.id}
              AND ter."status" = 'PENDING'
            LIMIT 1
        `;
        const request = requests[0];

        if (!request) {
            return { success: false, error: "Only pending manual entry requests can be cancelled." };
        }

        const deleted = await prisma.$executeRaw`
            DELETE FROM "TimeEntryRequest"
            WHERE "id" = ${requestId}
              AND "userId" = ${session.user.id}
              AND "status" = 'PENDING'
        `;

        if (deleted === 0) {
            return { success: false, error: "Only pending manual entry requests can be cancelled." };
        }

        await prisma.notification.deleteMany({
            where: {
                type: "TIME_ENTRY_REQUEST",
                href: "/admin/timesheets",
                message: `${request.userName} requested a manual time entry.`,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "TIME_ENTRY_REQUEST_CANCELLED",
                userId: session.user.id,
                details: `Cancelled pending manual entry request ${requestId}.`,
            },
        });

        revalidatePath("/timesheets");
        revalidatePath("/admin/timesheets");
        return { success: true };
    } catch (error) {
        console.error("Error cancelling manual time entry request:", error);
        return { success: false, error: "Failed to cancel manual time entry request." };
    }
}

export async function getClockStatus() {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return emptyClockStatus();
        }

        const employeeId = session.user.id;

        const activeLog = await prisma.timeLog.findFirst({
            where: {
                userId: employeeId,
                clockOut: null,
            },
            orderBy: {
                clockIn: "desc",
            },
        });

        return buildClockStatus(activeLog);
    } catch (error) {
        console.error("Error getting clock status:", error);
        return emptyClockStatus();
    }
}
