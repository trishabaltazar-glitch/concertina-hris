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

async function getValidatedLeaveInput(formData: FormData) {
    const leaveType = formData.get("leaveType") as string;
    const startDateStr = formData.get("startDate") as string;
    const endDateStr = formData.get("endDate") as string;
    const reason = formData.get("reason") as string;
    const dayType = (formData.get("dayType") as string) === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY";
    const attachment = formData.get("attachment");

    if (!leaveType || !startDateStr || !endDateStr) {
        return { error: "Missing required fields" };
    }

    const startDate = new Date(startDateStr);
    const endDate = dayType === "HALF_DAY" ? new Date(startDateStr) : new Date(endDateStr);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return { error: "Enter a valid leave date" };
    }

    const requestedDays = getRequestedDays(startDate, endDate, dayType);

    if (endDate < startDate) {
        return { error: "End date cannot be before start date" };
    }

    let attachmentName: string | null = null;
    let attachmentType: string | null = null;
    let attachmentData: Buffer | null = null;

    if (attachment instanceof File && attachment.size > 0) {
        const maxAttachmentSize = 5 * 1024 * 1024;
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

        if (attachment.size > maxAttachmentSize) {
            return { error: "Attachment must be 5MB or smaller" };
        }

        if (!allowedTypes.includes(attachment.type)) {
            return { error: "Attachment must be a PDF or image file" };
        }

        attachmentName = attachment.name;
        attachmentType = attachment.type;
        attachmentData = Buffer.from(await attachment.arrayBuffer());
    }

    return {
        leaveType,
        startDate,
        endDate,
        reason,
        dayType,
        requestedDays,
        attachmentName,
        attachmentType,
        attachmentData,
    };
}

export async function submitLeaveRequest(formData: FormData) {
    try {
        const parsed = await getValidatedLeaveInput(formData);
        if ("error" in parsed) return { success: false, error: parsed.error };

        const session = await auth();
        if (!session || !session.user || !session.user.id) {
            return { success: false, error: "Not authenticated" };
        }

        const employeeId = session.user.id;

        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                userId: employeeId,
                leaveType: parsed.leaveType,
                startDate: parsed.startDate,
                endDate: parsed.endDate,
                reason: parsed.reason,
                status: "PENDING",
            },
            include: {
                user: true,
            },
        });

        if (parsed.attachmentData) {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET
                    "dayType" = ${parsed.dayType},
                    "requestedDays" = ${parsed.requestedDays},
                    "attachmentName" = ${parsed.attachmentName},
                    "attachmentType" = ${parsed.attachmentType},
                    "attachmentData" = ${parsed.attachmentData}
                WHERE "id" = ${leaveRequest.id}
            `;
        } else {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET "dayType" = ${parsed.dayType}, "requestedDays" = ${parsed.requestedDays}
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

        const dateRange = parsed.dayType === "HALF_DAY" ? `${parsed.startDate.toLocaleDateString()} (half-day)` : formatLeaveDateRange(parsed.startDate, parsed.endDate);
        const leaveLabel = parsed.leaveType === "LEAVE_CREDITS" ? "PFFD" : parsed.leaveType;

        await createNotifications(
            reviewers.map((reviewer) => ({
                userId: reviewer.id,
                title: "New leave request",
                message: `${leaveRequest.user.name} requested ${leaveLabel} for ${dateRange}.`,
                href: "/admin/leaves",
                type: "LEAVE_REQUEST",
            }))
        );

        void sendLeaveNotificationEmail({
            to: reviewers.map((reviewer) => reviewer.email),
            subject: `New ${leaveLabel} request from ${leaveRequest.user.name}`,
            heading: "New leave request",
            message: `${leaveRequest.user.name} requested ${leaveLabel} for ${dateRange}.`,
            actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ""}/admin/leaves`,
            actionLabel: "Review request",
        }).catch((error) => {
            console.error("Failed to send leave request notification email:", error);
        });

        revalidatePath("/leaves");
        revalidatePath("/admin/leaves");
        return { success: true };
    } catch (error) {
        console.error("Error submitting leave request:", error);
        return { success: false, error: "Failed to submit request" };
    }
}

export async function updatePendingLeaveRequest(requestId: string, formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const existing = await prisma.leaveRequest.findFirst({
            where: { id: requestId, userId: session.user.id, status: "PENDING" },
            select: { id: true },
        });

        if (!existing) {
            return { success: false, error: "Only pending requests can be edited." };
        }

        const parsed = await getValidatedLeaveInput(formData);
        if ("error" in parsed) return { success: false, error: parsed.error };

        await prisma.leaveRequest.update({
            where: { id: requestId },
            data: {
                leaveType: parsed.leaveType,
                startDate: parsed.startDate,
                endDate: parsed.endDate,
                reason: parsed.reason,
            },
        });

        if (parsed.attachmentData) {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET
                    "dayType" = ${parsed.dayType},
                    "requestedDays" = ${parsed.requestedDays},
                    "attachmentName" = ${parsed.attachmentName},
                    "attachmentType" = ${parsed.attachmentType},
                    "attachmentData" = ${parsed.attachmentData}
                WHERE "id" = ${requestId}
            `;
        } else {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET
                    "dayType" = ${parsed.dayType},
                    "requestedDays" = ${parsed.requestedDays}
                WHERE "id" = ${requestId}
            `;
        }

        await prisma.auditLog.create({
            data: {
                action: "LEAVE_REQUEST_UPDATED",
                userId: session.user.id,
                details: `Updated pending leave request ${requestId}.`,
            },
        });

        revalidatePath("/leaves");
        revalidatePath("/admin/leaves");
        return { success: true };
    } catch (error) {
        console.error("Error updating leave request:", error);
        return { success: false, error: "Failed to update request" };
    }
}

export async function cancelPendingLeaveRequest(requestId: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const request = await prisma.leaveRequest.findFirst({
            where: { id: requestId, userId: session.user.id, status: "PENDING" },
            include: { user: { select: { name: true } } },
        });

        if (!request) {
            return { success: false, error: "Only pending requests can be cancelled." };
        }

        const deleted = await prisma.leaveRequest.deleteMany({
            where: { id: requestId, userId: session.user.id, status: "PENDING" },
        });

        if (deleted.count === 0) {
            return { success: false, error: "Only pending requests can be cancelled." };
        }

        await prisma.notification.deleteMany({
            where: {
                type: "LEAVE_REQUEST",
                href: "/admin/leaves",
                message: {
                    startsWith: `${request.user.name} requested`,
                },
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "LEAVE_REQUEST_CANCELLED",
                userId: session.user.id,
                details: `Cancelled pending leave request ${requestId}.`,
            },
        });

        revalidatePath("/leaves");
        revalidatePath("/admin/leaves");
        return { success: true };
    } catch (error) {
        console.error("Error cancelling leave request:", error);
        return { success: false, error: "Failed to cancel request" };
    }
}
