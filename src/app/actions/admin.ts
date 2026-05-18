"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createNotification } from "@/lib/notifications";
import { sendLeaveNotificationEmail } from "@/lib/leave-notification-email";

function formatLeaveDateRange(startDate: Date, endDate: Date) {
    return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}

function getTimeLogStatus(clockIn: Date) {
    const startOfWorkday = new Date(clockIn);
    startOfWorkday.setHours(9, 0, 0, 0);
    return clockIn > startOfWorkday ? "LATE" : "ON_TIME";
}


export async function updateLeaveRequestStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    try {
        const session = await auth();
        const role = (session?.user as { role?: string } | undefined)?.role;

        if (!session?.user?.id || (role !== "ADMIN" && role !== "MANAGER")) {
            return { success: false, error: "Unauthorized" };
        }

        const request = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });

        if (!request) {
            return { success: false, error: "Request not found" };
        }

        if (role === "MANAGER" && request.user.managerId !== session.user.id) {
            return { success: false, error: "You can only review requests from your direct reports." };
        }

        const requestMeta = await prisma.$queryRaw<{ requestedDays: number; dayType: string }[]>`
            SELECT "requestedDays", "dayType"
            FROM "LeaveRequest"
            WHERE "id" = ${requestId}
            LIMIT 1
        `;

        // If status hasn't changed, do nothing
        if (request.status === status) {
            return { success: true };
        }

        // 1. Update the request status
        await prisma.leaveRequest.update({
            where: { id: requestId },
            data: { status },
        });

        // 2. Adjust balance based on state transition
        const msPerDay = 1000 * 60 * 60 * 24;
        const fallbackDaysRequested = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / msPerDay) + 1;
        const daysRequested = requestMeta[0]?.requestedDays || fallbackDaysRequested;

        if (status === "APPROVED" && request.status !== "APPROVED") {
            // Deduct from balance
            await prisma.leaveBalance.updateMany({
                where: { userId: request.userId, leaveType: request.leaveType },
                data: { balance: { decrement: daysRequested } }
            });
        } else if (status === "REJECTED" && request.status === "APPROVED") {
            // Refund the balance if it was previously approved
            await prisma.leaveBalance.updateMany({
                where: { userId: request.userId, leaveType: request.leaveType },
                data: { balance: { increment: daysRequested } }
            });
        }

        const leaveLabel = request.leaveType === "LEAVE_CREDITS" ? "PFFD" : request.leaveType;
        const statusLabel = status === "APPROVED" ? "approved" : "rejected";
        const dateRange =
            requestMeta[0]?.dayType === "HALF_DAY"
                ? `${request.startDate.toLocaleDateString()} (half-day)`
                : formatLeaveDateRange(request.startDate, request.endDate);

        await createNotification({
            userId: request.userId,
            title: `Leave request ${statusLabel}`,
            message: `Your ${leaveLabel} request for ${dateRange} was ${statusLabel}.`,
            href: "/leaves",
            type: status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        });

        await sendLeaveNotificationEmail({
            to: [request.user.email],
            subject: `Your ${leaveLabel} request was ${statusLabel}`,
            heading: `Leave request ${statusLabel}`,
            message: `Your ${leaveLabel} request for ${dateRange} was ${statusLabel}.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""}/leaves`,
            actionLabel: "View request",
        });

        // Revalidate affected paths
        revalidatePath("/");
        revalidatePath("/admin/leaves");
        revalidatePath("/leaves");

        return { success: true };
    } catch (error) {
        console.error("Error updating leave request:", error);
        return { success: false, error: "Failed to update request" };
    }
}

type ManualTimeEntryRequestRow = {
    id: string;
    userId: string;
    clockIn: Date;
    clockOut: Date;
    reason: string | null;
    status: string;
    userName: string;
};

export async function updateManualTimeEntryRequestStatus(
    requestId: string,
    status: "APPROVED" | "REJECTED"
) {
    try {
        const session = await auth();
        const role = (session?.user as { role?: string } | undefined)?.role;

        if (!session?.user?.id || (role !== "ADMIN" && role !== "MANAGER")) {
            return { success: false, error: "Unauthorized" };
        }
        const reviewerId = session.user.id;

        const requests = await prisma.$queryRaw<ManualTimeEntryRequestRow[]>`
            SELECT
                ter."id",
                ter."userId",
                ter."clockIn",
                ter."clockOut",
                ter."reason",
                ter."status",
                u."name" as "userName"
            FROM "TimeEntryRequest" ter
            INNER JOIN "User" u ON u."id" = ter."userId"
            WHERE ter."id" = ${requestId}
            LIMIT 1
        `;
        const request = requests[0];

        if (!request) {
            return { success: false, error: "Request not found" };
        }

        if (request.status !== "PENDING") {
            return { success: false, error: "This request has already been reviewed." };
        }

        if (role === "MANAGER") {
            const directReport = await prisma.user.findFirst({
                where: { id: request.userId, managerId: reviewerId },
                select: { id: true },
            });

            if (!directReport) {
                return { success: false, error: "You can only review requests from your direct reports." };
            }
        }

        if (status === "APPROVED") {
            const overlappingLogs = await prisma.timeLog.count({
                where: {
                    userId: request.userId,
                    clockIn: { lt: request.clockOut },
                    clockOut: { gt: request.clockIn },
                },
            });

            if (overlappingLogs > 0) {
                return { success: false, error: "This request overlaps an existing time log." };
            }
        }

        await prisma.$transaction(async (tx) => {
            if (status === "APPROVED") {
                await tx.timeLog.create({
                    data: {
                        userId: request.userId,
                        clockIn: request.clockIn,
                        clockOut: request.clockOut,
                        status: getTimeLogStatus(request.clockIn),
                    },
                });
            }

            await tx.$executeRaw`
                UPDATE "TimeEntryRequest"
                SET
                    "status" = ${status},
                    "reviewedById" = ${reviewerId},
                    "reviewedAt" = ${new Date()},
                    "updatedAt" = ${new Date()}
                WHERE "id" = ${request.id}
            `;

            await tx.auditLog.create({
                data: {
                    action: status === "APPROVED" ? "TIME_ENTRY_APPROVED" : "TIME_ENTRY_REJECTED",
                    userId: reviewerId,
                    details: `${status.toLowerCase()} manual time entry request ${request.id} for ${request.userName}.`,
                },
            });
        });

        const statusLabel = status === "APPROVED" ? "approved" : "rejected";
        await createNotification({
            userId: request.userId,
            title: `Manual time entry ${statusLabel}`,
            message: `Your manual time entry request was ${statusLabel}.`,
            href: "/timesheets",
            type: status === "APPROVED" ? "TIME_ENTRY_APPROVED" : "TIME_ENTRY_REJECTED",
        });

        revalidatePath("/");
        revalidatePath("/timesheets");
        revalidatePath("/admin/timesheets");
        revalidatePath("/notifications");

        return { success: true };
    } catch (error) {
        console.error("Error updating manual time entry request:", error);
        return { success: false, error: "Failed to update manual time entry request." };
    }
}
