"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";


export async function updateLeaveRequestStatus(requestId: string, status: "APPROVED" | "REJECTED") {
    try {
        const request = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });

        if (!request) {
            return { success: false, error: "Request not found" };
        }

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
        const daysRequested = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / msPerDay) + 1;

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
