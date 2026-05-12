"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createNotifications } from "@/lib/notifications";
import { sendLeaveNotificationEmail } from "@/lib/leave-notification-email";

function formatLeaveDateRange(startDate: Date, endDate: Date) {
    return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}

function getRequestedDays(startDate: Date, endDate: Date, dayType: string) {
    if (dayType === "HALF_DAY") return 0.5;

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
}


export async function submitLeaveRequest(formData: FormData) {
    try {
        const leaveType = formData.get("leaveType") as string;
        const startDateStr = formData.get("startDate") as string;
        const endDateStr = formData.get("endDate") as string;
        const reason = formData.get("reason") as string;
        const dayType = (formData.get("dayType") as string) === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY";
        const attachment = formData.get("attachment");

        if (!leaveType || !startDateStr || !endDateStr) {
            return { success: false, error: "Missing required fields" };
        }

        const startDate = new Date(startDateStr);
        const endDate = dayType === "HALF_DAY" ? new Date(startDateStr) : new Date(endDateStr);

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return { success: false, error: "Enter a valid leave date" };
        }

        const requestedDays = getRequestedDays(startDate, endDate, dayType);

        if (endDate < startDate) {
            return { success: false, error: "End date cannot be before start date" };
        }

        let attachmentName: string | null = null;
        let attachmentType: string | null = null;
        let attachmentData: Buffer | null = null;

        if (attachment instanceof File && attachment.size > 0) {
            const maxAttachmentSize = 5 * 1024 * 1024;
            const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

            if (attachment.size > maxAttachmentSize) {
                return { success: false, error: "Attachment must be 5MB or smaller" };
            }

            if (!allowedTypes.includes(attachment.type)) {
                return { success: false, error: "Attachment must be a PDF or image file" };
            }

            attachmentName = attachment.name;
            attachmentType = attachment.type;
            attachmentData = Buffer.from(await attachment.arrayBuffer());
        }

        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
        }

        const employeeId = session.user.id;

        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                userId: employeeId,
                leaveType,
                startDate,
                endDate,
                reason,
                status: "PENDING",
            },
            include: {
                user: true,
            },
        });

        if (attachmentData) {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET
                    "dayType" = ${dayType},
                    "requestedDays" = ${requestedDays},
                    "attachmentName" = ${attachmentName},
                    "attachmentType" = ${attachmentType},
                    "attachmentData" = ${attachmentData}
                WHERE "id" = ${leaveRequest.id}
            `;
        } else {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET "dayType" = ${dayType}, "requestedDays" = ${requestedDays}
                WHERE "id" = ${leaveRequest.id}
            `;
        }

        const reviewers = await prisma.user.findMany({
            where: {
                isActive: true,
                role: { in: ["ADMIN", "MANAGER"] },
            },
            select: {
                id: true,
                email: true,
            },
        });

        const dateRange = dayType === "HALF_DAY" ? `${startDate.toLocaleDateString()} (half-day)` : formatLeaveDateRange(startDate, endDate);
        const leaveLabel = leaveType === "LEAVE_CREDITS" ? "PFFD" : leaveType;

        await createNotifications(
            reviewers.map((reviewer) => ({
                userId: reviewer.id,
                title: "New leave request",
                message: `${leaveRequest.user.name} requested ${leaveLabel} for ${dateRange}.`,
                href: "/admin/leaves",
                type: "LEAVE_REQUEST",
            }))
        );

        await sendLeaveNotificationEmail({
            to: reviewers.map((reviewer) => reviewer.email),
            subject: `New ${leaveLabel} request from ${leaveRequest.user.name}`,
            heading: "New leave request",
            message: `${leaveRequest.user.name} requested ${leaveLabel} for ${dateRange}.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""}/admin/leaves`,
            actionLabel: "Review request",
        });

        revalidatePath("/leaves");
        revalidatePath("/admin/leaves");
        return { success: true };
    } catch (error) {
        console.error("Error submitting leave request:", error);
        return { success: false, error: "Failed to submit request" };
    }
}
