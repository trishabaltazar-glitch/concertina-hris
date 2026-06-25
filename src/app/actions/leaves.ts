"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { createNotifications } from "@/lib/notifications";
import { sendLeaveNotificationEmail } from "@/lib/leave-notification-email";

async function ensureLeaveDayBreakdownColumn() {
    // Managed by Prisma migration 20260519010000_add_leave_day_breakdown.
}

function formatLeaveDateRange(startDate: Date, endDate: Date) {
    return `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
}

type LeaveDayBreakdownItem = {
    date: string;
    dayType: "FULL_DAY" | "HALF_DAY";
    days: number;
};

function formatLeaveBreakdown(dayBreakdown: LeaveDayBreakdownItem[] | null | undefined, startDate: Date, endDate: Date, dayType: string) {
    if (dayBreakdown?.length) {
        if (dayBreakdown.length === 1) {
            const item = dayBreakdown[0];
            return `${new Date(`${item.date}T00:00:00`).toLocaleDateString()} (${item.dayType === "HALF_DAY" ? "half-day" : "full day"})`;
        }

        return `${dayBreakdown.length} selected dates (${dayBreakdown.reduce((sum, item) => sum + item.days, 0)} PFFD days)`;
    }

    return dayType === "HALF_DAY" ? `${startDate.toLocaleDateString()} (half-day)` : formatLeaveDateRange(startDate, endDate);
}

function getRequestedDays(startDate: Date, endDate: Date, dayType: string) {
    if (dayType === "HALF_DAY") return 0.5;

    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1);
}

function getDateOnly(value: string) {
    return value.match(/^\d{4}-\d{2}-\d{2}$/) ? value : null;
}

function parseDayBreakdown(formData: FormData) {
    const dates = formData.getAll("leaveDate").map((value) => String(value));
    const dayTypes = formData.getAll("leaveDateType").map((value) => String(value));
    const items: LeaveDayBreakdownItem[] = [];

    dates.forEach((date, index) => {
        const dateOnly = getDateOnly(date);
        const dayType = dayTypes[index] === "HALF_DAY" ? "HALF_DAY" : dayTypes[index] === "FULL_DAY" ? "FULL_DAY" : null;

        if (!dateOnly || !dayType) {
            return;
        }

        if (items.some((item) => item.date === dateOnly)) {
            return;
        }

        items.push({
            date: dateOnly,
            dayType,
            days: dayType === "HALF_DAY" ? 0.5 : 1,
        });
    });

    items.sort((a, b) => a.date.localeCompare(b.date));
    return items;
}

async function getValidatedLeaveInput(formData: FormData) {
    const leaveType = formData.get("leaveType") as string;
    const startDateStr = formData.get("startDate") as string;
    const endDateStr = formData.get("endDate") as string;
    const reason = String(formData.get("reason") || "").trim();
    const attachment = formData.get("attachment");
    const dayBreakdown = parseDayBreakdown(formData);

    if (!leaveType || !startDateStr || !endDateStr) {
        return { error: "Missing required fields" };
    }

    if (!reason) {
        return { error: "Reason is required" };
    }

    let dayType = "FULL_DAY";
    let startDate = new Date(startDateStr);
    let endDate = new Date(endDateStr);

    if (dayBreakdown.length > 0) {
        startDate = new Date(`${dayBreakdown[0].date}T00:00:00`);
        endDate = new Date(`${dayBreakdown[dayBreakdown.length - 1].date}T00:00:00`);
        const hasFullDays = dayBreakdown.some((item) => item.dayType === "FULL_DAY");
        const hasHalfDays = dayBreakdown.some((item) => item.dayType === "HALF_DAY");
        dayType = hasFullDays && hasHalfDays ? "CUSTOM" : hasHalfDays ? "HALF_DAY" : "FULL_DAY";
    } else {
        dayType = (formData.get("dayType") as string) === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY";
        endDate = dayType === "HALF_DAY" ? new Date(startDateStr) : new Date(endDateStr);
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return { error: "Enter a valid leave date" };
    }

    const requestedDays = dayBreakdown.length > 0 ? dayBreakdown.reduce((sum, item) => sum + item.days, 0) : getRequestedDays(startDate, endDate, dayType);

    if (endDate < startDate) {
        return { error: "End date cannot be before start date" };
    }

    if (requestedDays <= 0) {
        return { error: "Select at least one request date" };
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
        dayBreakdown,
        attachmentName,
        attachmentType,
        attachmentData,
    };
}

export async function submitLeaveRequest(formData: FormData) {
    try {
        await ensureLeaveDayBreakdownColumn();

        const parsed = await getValidatedLeaveInput(formData);
        if ("error" in parsed) return { success: false, error: parsed.error };

        if (!parsed.attachmentData) {
            return { success: false, error: "Attachment is required" };
        }

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
                    "dayBreakdown" = ${JSON.stringify(parsed.dayBreakdown)}::jsonb,
                    "attachmentName" = ${parsed.attachmentName},
                    "attachmentType" = ${parsed.attachmentType},
                    "attachmentData" = ${parsed.attachmentData}
                WHERE "id" = ${leaveRequest.id}
            `;
        } else {
            await prisma.$executeRaw`
                UPDATE "LeaveRequest"
                SET "dayType" = ${parsed.dayType}, "requestedDays" = ${parsed.requestedDays}, "dayBreakdown" = ${JSON.stringify(parsed.dayBreakdown)}::jsonb
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

        const dateRange = formatLeaveBreakdown(parsed.dayBreakdown, parsed.startDate, parsed.endDate, parsed.dayType);
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
        await ensureLeaveDayBreakdownColumn();

        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" };
        }

        const existing = await prisma.leaveRequest.findFirst({
            where: { id: requestId, userId: session.user.id, status: "PENDING" },
            select: { id: true, attachmentName: true },
        });

        if (!existing) {
            return { success: false, error: "Only pending requests can be edited." };
        }

        const parsed = await getValidatedLeaveInput(formData);
        if ("error" in parsed) return { success: false, error: parsed.error };

        if (!parsed.attachmentData && !existing.attachmentName) {
            return { success: false, error: "Attachment is required" };
        }

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
                    "dayBreakdown" = ${JSON.stringify(parsed.dayBreakdown)}::jsonb,
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
                    "requestedDays" = ${parsed.requestedDays},
                    "dayBreakdown" = ${JSON.stringify(parsed.dayBreakdown)}::jsonb
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
