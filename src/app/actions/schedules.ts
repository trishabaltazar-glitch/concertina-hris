"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";


export async function upsertSchedule(userId: string, dayOfWeek: number, startTime: string, endTime: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
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
