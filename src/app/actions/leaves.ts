"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";


export async function submitLeaveRequest(formData: FormData) {
    try {
        const leaveType = formData.get("leaveType") as string;
        const startDateStr = formData.get("startDate") as string;
        const endDateStr = formData.get("endDate") as string;
        const reason = formData.get("reason") as string;

        if (!leaveType || !startDateStr || !endDateStr) {
            return { success: false, error: "Missing required fields" };
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
        }

        const employeeId = session.user.id;

        await prisma.leaveRequest.create({
            data: {
                userId: employeeId,
                leaveType,
                startDate,
                endDate,
                reason,
                status: "PENDING",
            },
        });

        revalidatePath("/leaves");
        return { success: true };
    } catch (error) {
        console.error("Error submitting leave request:", error);
        return { success: false, error: "Failed to submit request" };
    }
}
