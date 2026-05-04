"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { auth } from "@/auth"; // import the auth module


export async function toggleClockStatus() {
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
                await prisma.timeLog.update({
                    where: { id: activeLog.id },
                    data: { clockOut: now },
                });

                await prisma.auditLog.create({
                    data: { action: "CLOCK_OUT", userId: employeeId, details: "User clocked out." }
                });

                revalidatePath("/");
                return { success: true };
            }
        }

        // 2. User is clocking in (either standard, or after an auto-checkout)
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
        const isLate = now > startOfDay;

        await prisma.timeLog.create({
            data: {
                userId: employeeId,
                clockIn: now,
                status: isLate ? "LATE" : "ON_TIME",
            },
        });

        await prisma.auditLog.create({
            data: { action: "CLOCK_IN", userId: employeeId, details: isLate ? "Late Clock In" : "On-Time Clock In" }
        });

        // Refresh the dashboard data
        revalidatePath("/");

        return { success: true };
    } catch (error) {
        console.error("Error toggling clock status:", error);
        return { success: false, error: "Failed to update time log" };
    }
}

export async function getClockStatus() {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { isClockedIn: false, clockInTime: null };
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

        return {
            isClockedIn: !!activeLog,
            clockInTime: activeLog?.clockIn || null
        };
    } catch (error) {
        console.error("Error getting clock status:", error);
        return { isClockedIn: false, clockInTime: null };
    }
}
