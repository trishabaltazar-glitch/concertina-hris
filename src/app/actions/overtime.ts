"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { ensureOvertimeRequestTable } from "@/lib/overtime-requests";
import { createNotification, createNotifications } from "@/lib/notifications";

const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : "";
}

function parseDateTime(dateValue: FormDataEntryValue | null, timeValue: FormDataEntryValue | null) {
  if (typeof dateValue !== "string" || typeof timeValue !== "string" || !dateValue || !timeValue) return null;
  const date = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function submitOvertimeRequest(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  await ensureOvertimeRequestTable();

  const startAt = parseDateTime(formData.get("startDate"), formData.get("startTime"));
  const endAt = parseDateTime(formData.get("endDate"), formData.get("endTime"));
  const reason = cleanText(formData.get("reason"), 500);
  const attachment = formData.get("attachment");

  if (!startAt || !endAt || !reason) {
    return { success: false, error: "Start, end, and reason are required." };
  }

  if (endAt <= startAt) {
    return { success: false, error: "OT end must be after OT start." };
  }

  if (!(attachment instanceof File) || attachment.size === 0) {
    return { success: false, error: "Attachment is required." };
  }

  if (attachment.size > MAX_ATTACHMENT_SIZE) {
    return { success: false, error: "Attachment must be 5MB or smaller." };
  }

  if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
    return { success: false, error: "Attachment must be a PDF or image file." };
  }

  const attachmentData = Buffer.from(await attachment.arrayBuffer());
  const requestId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "OvertimeRequest" (
      "id", "userId", "startAt", "endAt", "reason", "attachmentName", "attachmentType", "attachmentData", "createdAt", "updatedAt"
    )
    VALUES (
      ${requestId}, ${session.user.id}, ${startAt}, ${endAt}, ${reason}, ${attachment.name}, ${attachment.type}, ${attachmentData}, ${new Date()}, ${new Date()}
    )
  `;

  const employee = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, managerId: true },
  });
  const reviewers = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        ...(employee?.managerId ? [{ id: employee.managerId }] : []),
      ],
    },
    select: { id: true },
  });

  await createNotifications(
    reviewers.map((reviewer) => ({
      userId: reviewer.id,
      title: "New OT request",
      message: `${employee?.name || "An employee"} filed an overtime request.`,
      href: "/admin/overtime",
      type: "INFO",
    }))
  );

  revalidatePath("/overtime");
  revalidatePath("/admin/overtime");
  revalidatePath("/admin/approvals");
  revalidatePath("/notifications");
  return { success: true };
}

export async function updatePendingOvertimeRequest(requestId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  await ensureOvertimeRequestTable();

  const existing = await prisma.$queryRaw<{ id: string; attachmentName: string }[]>`
    SELECT "id", "attachmentName"
    FROM "OvertimeRequest"
    WHERE "id" = ${requestId}
      AND "userId" = ${session.user.id}
      AND "status" = 'PENDING'
    LIMIT 1
  `;

  if (!existing[0]) {
    return { success: false, error: "Only pending OT requests can be edited." };
  }

  const startAt = parseDateTime(formData.get("startDate"), formData.get("startTime"));
  const endAt = parseDateTime(formData.get("endDate"), formData.get("endTime"));
  const reason = cleanText(formData.get("reason"), 500);
  const attachment = formData.get("attachment");

  if (!startAt || !endAt || !reason) {
    return { success: false, error: "Start, end, and reason are required." };
  }

  if (endAt <= startAt) {
    return { success: false, error: "OT end must be after OT start." };
  }

  if (startAt > new Date()) {
    return { success: false, error: "OT requests cannot start in the future." };
  }

  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_SIZE) {
      return { success: false, error: "Attachment must be 5MB or smaller." };
    }

    if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
      return { success: false, error: "Attachment must be a PDF or image file." };
    }

    const attachmentData = Buffer.from(await attachment.arrayBuffer());

    await prisma.$executeRaw`
      UPDATE "OvertimeRequest"
      SET
        "startAt" = ${startAt},
        "endAt" = ${endAt},
        "reason" = ${reason},
        "attachmentName" = ${attachment.name},
        "attachmentType" = ${attachment.type},
        "attachmentData" = ${attachmentData},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${requestId}
        AND "userId" = ${session.user.id}
        AND "status" = 'PENDING'
    `;
  } else {
    await prisma.$executeRaw`
      UPDATE "OvertimeRequest"
      SET
        "startAt" = ${startAt},
        "endAt" = ${endAt},
        "reason" = ${reason},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${requestId}
        AND "userId" = ${session.user.id}
        AND "status" = 'PENDING'
    `;
  }

  revalidatePath("/overtime");
  revalidatePath("/admin/overtime");
  return { success: true };
}

export async function cancelPendingOvertimeRequest(requestId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  await ensureOvertimeRequestTable();

  const deleted = await prisma.$executeRaw`
    DELETE FROM "OvertimeRequest"
    WHERE "id" = ${requestId}
      AND "userId" = ${session.user.id}
      AND "status" = 'PENDING'
  `;

  if (deleted === 0) {
    return { success: false, error: "Only pending OT requests can be cancelled." };
  }

  revalidatePath("/overtime");
  revalidatePath("/admin/overtime");
  return { success: true };
}

export async function updateOvertimeRequestStatus(requestId: string, status: "APPROVED" | "REJECTED") {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id || (role !== "ADMIN" && role !== "MANAGER")) {
    return { success: false, error: "Unauthorized" };
  }

  await ensureOvertimeRequestTable();

  const rows = await prisma.$queryRaw<
    { id: string; userId: string; currentStatus: string; userName: string; managerId: string | null; role: string }[]
  >`
    SELECT
      ot."id",
      ot."userId",
      ot."status" as "currentStatus",
      u."name" as "userName",
      u."managerId",
      u."role"
    FROM "OvertimeRequest" ot
    INNER JOIN "User" u ON u."id" = ot."userId"
    WHERE ot."id" = ${requestId}
    LIMIT 1
  `;
  const request = rows[0];

  if (!request) return { success: false, error: "OT request not found." };
  if (request.currentStatus !== "PENDING") return { success: false, error: "This OT request has already been reviewed." };

  if (role === "MANAGER" && (request.role !== "EMPLOYEE" || request.managerId !== session.user.id)) {
    return { success: false, error: "You can only review OT requests from your direct reports." };
  }

  await prisma.$executeRaw`
    UPDATE "OvertimeRequest"
    SET "status" = ${status}, "reviewedById" = ${session.user.id}, "reviewedAt" = ${new Date()}, "updatedAt" = ${new Date()}
    WHERE "id" = ${requestId}
  `;

  await createNotification({
    userId: request.userId,
    title: `OT request ${status === "APPROVED" ? "approved" : "rejected"}`,
    message: `Your overtime request was ${status.toLowerCase()}.`,
    href: "/overtime",
    type: "INFO",
  });

  revalidatePath("/overtime");
  revalidatePath("/admin/overtime");
  revalidatePath("/notifications");
  return { success: true };
}
