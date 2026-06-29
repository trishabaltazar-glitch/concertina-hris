"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";


export async function updateProfile(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const contactNumber = (formData.get("contactNumber") as string) || null;
  const emergencyContact = (formData.get("emergencyContact") as string) || null;
  const address = (formData.get("address") as string) || null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      contactNumber,
      emergencyContact,
      address,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      action: "PROFILE_UPDATE",
      userId,
      details: "User updated their personal profile information.",
    }
  });

  revalidatePath("/profile");
}
