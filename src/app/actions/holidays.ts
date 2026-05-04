"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";


export async function createHoliday(formData: FormData) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    throw new Error("Unauthorized: Only admins and managers can create holidays.");
  }

  const name = formData.get("name") as string;
  const dateStr = formData.get("date") as string;
  const type = formData.get("type") as string;
  const description = formData.get("description") as string | null;

  if (!name || !dateStr || !type) {
    throw new Error("Name, date, and type are required.");
  }

  await prisma.holiday.create({
    data: {
      name,
      date: new Date(dateStr),
      type,
      description,
    },
  });

  revalidatePath("/admin/holidays");
  revalidatePath("/holidays");
  revalidatePath("/");
}

export async function deleteHoliday(holidayId: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    throw new Error("Unauthorized: Only admins and managers can delete holidays.");
  }

  await prisma.holiday.delete({
    where: {
      id: holidayId,
    },
  });

  revalidatePath("/admin/holidays");
  revalidatePath("/holidays");
  revalidatePath("/");
}
