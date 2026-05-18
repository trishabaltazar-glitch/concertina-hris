"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function parseHolidayDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function assignHolidayToTeamMembers(formData: FormData) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    throw new Error("Unauthorized: Only admins and managers can assign holidays.");
  }

  const name = cleanText(formData.get("name"), 120);
  const notes = cleanText(formData.get("notes"), 500);
  const date = parseHolidayDate(formData.get("date"));
  const userIds = formData
    .getAll("userIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (!name || !date || userIds.length === 0) {
    throw new Error("Holiday name, date, and at least one team member are required.");
  }

  const eligibleUsers = await prisma.user.findMany({
    where:
      sessionUser.role === "ADMIN"
        ? { id: { in: userIds } }
        : { id: { in: userIds }, managerId: sessionUser.id },
    select: { id: true, name: true },
  });

  if (eligibleUsers.length === 0) {
    throw new Error("No eligible team members selected.");
  }

  await prisma.$transaction(
    eligibleUsers.map((user) =>
      prisma.$executeRaw`
        INSERT INTO "HolidayAssignment" (
          "id",
          "userId",
          "assignedById",
          "name",
          "date",
          "notes",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${randomUUID()},
          ${user.id},
          ${sessionUser.id},
          ${name},
          ${date},
          ${notes},
          ${new Date()},
          ${new Date()}
        )
        ON CONFLICT ("userId", "date", "name")
        DO UPDATE SET
          "assignedById" = EXCLUDED."assignedById",
          "notes" = EXCLUDED."notes",
          "updatedAt" = EXCLUDED."updatedAt"
      `
    )
  );

  await createNotifications(
    eligibleUsers.map((user) => ({
      userId: user.id,
      title: "Holiday assigned",
      message: `${name} was assigned for ${date.toLocaleDateString()}. You do not need to clock in or out that day.`,
      href: "/schedule",
      type: "INFO",
    }))
  );

  await prisma.auditLog.create({
    data: {
      action: "HOLIDAY_ASSIGNED",
      userId: sessionUser.id,
      details: `Assigned ${name} on ${date.toISOString()} to ${eligibleUsers.length} employee(s).`,
    },
  });

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/admin/holidays");
  revalidatePath("/notifications");
}

export async function deleteHolidayAssignment(assignmentId: string) {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!sessionUser?.id || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    throw new Error("Unauthorized: Only admins and managers can remove holiday assignments.");
  }

  const assignments = await prisma.$queryRaw<
    { id: string; userId: string; userName: string; managerId: string | null; name: string; date: Date }[]
  >`
    SELECT
      ha."id",
      ha."userId",
      ha."name",
      ha."date",
      u."name" as "userName",
      u."managerId"
    FROM "HolidayAssignment" ha
    INNER JOIN "User" u ON u."id" = ha."userId"
    WHERE ha."id" = ${assignmentId}
    LIMIT 1
  `;
  const assignment = assignments[0];

  if (!assignment) return;

  if (sessionUser.role === "MANAGER" && assignment.managerId !== sessionUser.id) {
    throw new Error("Unauthorized: You can only remove assignments for your direct reports.");
  }

  await prisma.$executeRaw`
    DELETE FROM "HolidayAssignment"
    WHERE "id" = ${assignmentId}
  `;

  await prisma.auditLog.create({
    data: {
      action: "HOLIDAY_ASSIGNMENT_REMOVED",
      userId: sessionUser.id,
      details: `Removed ${assignment.name} on ${assignment.date.toISOString()} for ${assignment.userName}.`,
    },
  });

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/admin/holidays");
}
