"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";


export async function updateProfile(formData: FormData) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user) {
    throw new Error("Unauthorized");
  }

  const contactNumber = formData.get("contactNumber") as string || null;
  const emergencyContact = formData.get("emergencyContact") as string || null;
  const address = formData.get("address") as string || null;

  await prisma.user.update({
    where: { id: user.id },
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
      userId: user.id,
      details: "User updated their personal profile information.",
    }
  });

  revalidatePath("/profile");
}
