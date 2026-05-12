"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/auth"; // import the auth module


function cleanOptionalText(value?: string) {
    const cleaned = value?.trim();
    return cleaned ? cleaned.slice(0, 500) : null;
}

type ClockStatus = {
    isClockedIn: boolean;
    clockInTime: Date | null;
    isOnBreak: boolean;
    breakStartTime: Date | null;
};

function emptyClockStatus(): ClockStatus {
    return {
        isClockedIn: false,
        clockInTime: null,
        isOnBreak: false,
        breakStartTime: null,
    };
}

function buildClockStatus(activeLog: { clockIn: Date; breaks?: { startedAt: Date }[] } | null): ClockStatus {
    const activeBreak = activeLog?.breaks?.[0];

    return {
        isClockedIn: !!activeLog,
        clockInTime: activeLog?.clockIn || null,
        isOnBreak: !!activeBreak,
        breakStartTime: activeBreak?.startedAt || null,
    };
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
                await prisma.$transaction([
                    prisma.timeBreak.updateMany({
                        where: { timeLogId: activeLog.id, endedAt: null },
                        data: { endedAt: endOfYesterday },
                    }),
                    prisma.timeLog.update({
                        where: { id: activeLog.id },
                        data: { clockOut: endOfYesterday, status: "FORCED_CHECKOUT" },
                    }),
                ]);
                
                await prisma.auditLog.create({
                    data: { action: "FORCED_CLOCK_OUT", userId: employeeId, details: "System forcefully closed stale time log from previous day." }
                });
                // We let it continue below to create their new clock-in for today!
            } else {
                // Normal clock out for today
                const clockOutTime = new Date();
                await prisma.$transaction([
                    prisma.timeBreak.updateMany({
                        where: { timeLogId: activeLog.id, endedAt: null },
                        data: { endedAt: clockOutTime },
                    }),
                    prisma.timeLog.update({
                        where: { id: activeLog.id },
                        data: { clockOut: clockOutTime },
                    }),
                ]);

                await prisma.auditLog.create({
                    data: { action: "CLOCK_OUT", userId: employeeId, details: "User clocked out." }
                });

                revalidatePath("/");
                return { success: true, status: emptyClockStatus() };
            }
        }

        // 2. User is clocking in (either standard, or after an auto-checkout)
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

        return { success: true, status: buildClockStatus({ clockIn: timeLog.clockIn, breaks: [] }) };
    } catch (error) {
        console.error("Error toggling clock status:", error);
        return { success: false, error: "Failed to update time log" };
    }
}

export async function toggleBreakStatus() {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
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
            include: {
                breaks: {
                    where: { endedAt: null },
                    orderBy: { startedAt: "desc" },
                    take: 1,
                },
            },
        });

        if (!activeLog) {
            return { success: false, error: "Clock in before starting a break" };
        }

        const activeBreak = activeLog.breaks[0];
        const now = new Date();
        let nextStatus: ClockStatus;

        if (activeBreak) {
            await prisma.timeBreak.update({
                where: { id: activeBreak.id },
                data: { endedAt: now },
            });

            await prisma.auditLog.create({
                data: { action: "BREAK_END", userId: employeeId, details: "User ended break." }
            });

            nextStatus = buildClockStatus({ clockIn: activeLog.clockIn, breaks: [] });
        } else {
            const startedBreak = await prisma.timeBreak.create({
                data: {
                    timeLogId: activeLog.id,
                    startedAt: now,
                },
            });

            await prisma.auditLog.create({
                data: { action: "BREAK_START", userId: employeeId, details: "User started break." }
            });

            nextStatus = buildClockStatus({ clockIn: activeLog.clockIn, breaks: [{ startedAt: startedBreak.startedAt }] });
        }

        revalidatePath("/");
        revalidatePath("/timesheets");

        return { success: true, status: nextStatus };
    } catch (error) {
        console.error("Error toggling break status:", error);
        return { success: false, error: "Failed to update break" };
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
            include: {
                breaks: {
                    where: { endedAt: null },
                    orderBy: { startedAt: "desc" },
                    take: 1,
                },
            },
        });

        return buildClockStatus(activeLog);
    } catch (error) {
        console.error("Error getting clock status:", error);
        return emptyClockStatus();
    }
}
