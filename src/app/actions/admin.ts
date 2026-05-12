"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications";
import { sendLeaveNotificationEmail } from "@/lib/leave-notification-email";

function formatLeaveDateRange(startDate: Date, endDate: Date) {
    return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}


export async function updateLeaveRequestStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    try {
        const request = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });

        if (!request) {
            return { success: false, error: "Request not found" };
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
