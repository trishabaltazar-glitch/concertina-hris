"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

type ScheduleEntry = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function canManageSchedules(role?: string) {
  return role === "ADMIN" || role === "MANAGER";
}

async function canManageUserSchedule(actor: { id?: string; role?: string }, userId: string) {
  if (actor.role === "ADMIN") return true;
  if (!actor.id || actor.role !== "MANAGER") return false;

  const directReport = await prisma.user.findFirst({
    where: { id: userId, managerId: actor.id },
    select: { id: true },
  });

  return Boolean(directReport);
}

async function filterManageableScheduleUserIds(actor: { id?: string; role?: string }, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
  if (actor.role === "ADMIN") return uniqueUserIds;
  if (!actor.id || actor.role !== "MANAGER") return [];

  const directReports = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds }, managerId: actor.id },
    select: { id: true },
  });

  return directReports.map((user) => user.id);
}

export async function upsertSchedule(userId: string, dayOfWeek: number, startTime: string, endTime: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only Admins can manage schedules.");
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
    throw new Error("Unauthorized: Only Admins can manage schedules.");
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
    throw new Error("Unauthorized: Only Admins can manage schedules.");
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
