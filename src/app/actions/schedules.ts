"use server";

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";

type ScheduleEntry = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function cleanText(value: FormDataEntryValue | null, maxLength = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

function parseScheduleDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canManageSchedules(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

async function canManageUserSchedule(actor: { id?: string; role?: string }, userId: string) {
  if (actor.role === "ADMIN") return true;
  if (!actor.id || actor.role !== "MANAGER") return false;

  const directReport = await prisma.user.findFirst({
    where: { id: userId, managerId: actor.id, role: "EMPLOYEE" },
    select: { id: true },
  });

  return Boolean(directReport);
}

async function filterManageableScheduleUserIds(actor: { id?: string; role?: string }, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
  if (actor.role === "ADMIN") return uniqueUserIds;
  if (!actor.id || actor.role !== "MANAGER") return [];

  const directReports = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds }, managerId: actor.id, role: "EMPLOYEE" },
    select: { id: true },
  });

  return directReports.map((user) => user.id);
}

export async function upsertSchedule(userId: string, dayOfWeek: number, startTime: string, endTime: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only admins and managers can manage schedules.");
  }

  if (!(await canManageUserSchedule(user, userId))) {
    throw new Error("Unauthorized: You can only manage schedules for direct reports.");
  }

  // Allow clearing a schedule for a specific day by passing empty times
  if (!startTime || !endTime) {
     await prisma.schedule.deleteMany({
         where: { userId, dayOfWeek }
     });
  } else {
    await prisma.schedule.upsert({
      where: {
        userId_dayOfWeek: { userId, dayOfWeek },
      },
      update: { startTime, endTime },
      create: { userId, dayOfWeek, startTime, endTime },
    });
  }

  revalidatePath("/admin/schedules");
  revalidatePath("/schedule");
}

export async function upsertWeeklySchedule(userId: string, schedules: ScheduleEntry[]) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only admins and managers can manage schedules.");
  }

  if (!(await canManageUserSchedule(user, userId))) {
    throw new Error("Unauthorized: You can only manage schedules for direct reports.");
  }

  await prisma.$transaction(
    schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const startTime = schedule.startTime;
      const endTime = schedule.endTime;

      if (!startTime || !endTime) {
        return prisma.schedule.deleteMany({
          where: { userId, dayOfWeek },
        });
      }

      return prisma.schedule.upsert({
        where: {
          userId_dayOfWeek: { userId, dayOfWeek },
        },
        update: { startTime, endTime },
        create: { userId, dayOfWeek, startTime, endTime },
      });
    })
  );

  revalidatePath("/admin/schedules");
  revalidatePath("/schedule");
}

export async function upsertBulkSchedules(userIds: string[], schedules: ScheduleEntry[]) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only admins and managers can manage schedules.");
  }

  const manageableUserIds = await filterManageableScheduleUserIds(user, userIds);
  if (manageableUserIds.length === 0) {
    throw new Error("Unauthorized: You can only manage schedules for direct reports.");
  }

  const operations = manageableUserIds.flatMap((userId) =>
    schedules.map((schedule) => {
      const dayOfWeek = Number(schedule.dayOfWeek);
      const startTime = schedule.startTime;
      const endTime = schedule.endTime;

      if (!startTime || !endTime) {
        return prisma.schedule.deleteMany({
          where: { userId, dayOfWeek },
        });
      }

      return prisma.schedule.upsert({
        where: {
          userId_dayOfWeek: { userId, dayOfWeek },
        },
        update: { startTime, endTime },
        create: { userId, dayOfWeek, startTime, endTime },
      });
    })
  );

  await prisma.$transaction(operations);

  revalidatePath("/admin/schedules");
  revalidatePath("/schedule");
}

export async function upsertScheduleOverride(formData: FormData) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user?.id || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only admins and managers can manage schedules.");
  }
  await ensureScheduleOverrideTable();

  const userId = cleanText(formData.get("userId"), 120);
  const date = parseScheduleDate(formData.get("date"));
  const startTime = cleanText(formData.get("startTime"), 20);
  const endTime = cleanText(formData.get("endTime"), 20);
  const notes = cleanText(formData.get("notes"), 500);

  if (!userId || !date || !startTime || !endTime) {
    throw new Error("Employee, date, start time, and end time are required.");
  }

  if (!(await canManageUserSchedule(user, userId))) {
    throw new Error("Unauthorized: You can only manage schedules for direct reports.");
  }

  const savedOverrides = await prisma.$queryRaw<
    { id: string; date: Date; startTime: string; endTime: string; notes: string | null }[]
  >`
    INSERT INTO "ScheduleOverride" (
      "id",
      "userId",
      "assignedById",
      "date",
      "startTime",
      "endTime",
      "notes",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${userId},
      ${user.id},
      ${date},
      ${startTime},
      ${endTime},
      ${notes},
      ${new Date()},
      ${new Date()}
    )
    ON CONFLICT ("userId", "date")
    DO UPDATE SET
      "assignedById" = EXCLUDED."assignedById",
      "startTime" = EXCLUDED."startTime",
      "endTime" = EXCLUDED."endTime",
      "notes" = EXCLUDED."notes",
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "id", "date", "startTime", "endTime", "notes"
  `;
  const override = savedOverrides[0];

  await prisma.auditLog.create({
    data: {
      action: "SCHEDULE_OVERRIDE_UPDATED",
      userId: user.id,
      details: `Set special schedule on ${date.toISOString()} for user ${userId}: ${startTime}-${endTime}.`,
    },
  });

  revalidatePath("/admin/schedules");
  revalidatePath("/schedule");
  revalidatePath("/");

  return {
    id: override.id,
    date: override.date.toISOString(),
    startTime: override.startTime,
    endTime: override.endTime,
    notes: override.notes,
  };
}

export async function deleteScheduleOverride(overrideId: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user?.id || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only admins and managers can manage schedules.");
  }
  await ensureScheduleOverrideTable();

  const overrides = await prisma.$queryRaw<
    { id: string; date: Date; userId: string; userName: string; managerId: string | null; role: string }[]
  >`
    SELECT
      so."id",
      so."date",
      so."userId",
      u."name" as "userName",
      u."managerId",
      u."role"
    FROM "ScheduleOverride" so
    INNER JOIN "User" u ON u."id" = so."userId"
    WHERE so."id" = ${overrideId}
    LIMIT 1
  `;
  const override = overrides[0];

  if (!override) return;

  if (user.role === "MANAGER" && (override.role !== "EMPLOYEE" || override.managerId !== user.id)) {
    throw new Error("Unauthorized: You can only manage schedules for direct reports.");
  }

  await prisma.$executeRaw`
    DELETE FROM "ScheduleOverride"
    WHERE "id" = ${overrideId}
  `;

  await prisma.auditLog.create({
    data: {
      action: "SCHEDULE_OVERRIDE_REMOVED",
      userId: user.id,
      details: `Removed special schedule on ${override.date.toISOString()} for ${override.userName}.`,
    },
  });

  revalidatePath("/admin/schedules");
  revalidatePath("/schedule");
  revalidatePath("/");
}
