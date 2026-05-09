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

export async function upsertSchedule(userId: string, dayOfWeek: number, startTime: string, endTime: string) {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only Admins can manage schedules.");
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
  const user = session?.user as { role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only Admins can manage schedules.");
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
  const user = session?.user as { role?: string } | undefined;

  if (!session || !user || !canManageSchedules(user.role)) {
    throw new Error("Unauthorized: Only Admins can manage schedules.");
  }

  const operations = userIds.flatMap((userId) =>
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
