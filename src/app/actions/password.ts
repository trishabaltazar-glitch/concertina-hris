"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";


export async function changePassword(formData: FormData) {
    const session = await auth();
    if (!session || !session.user) {
        throw new Error("Unauthorized");
    }

    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!newPassword || !confirmPassword) {
        return { success: false, error: "Please fill out all fields." };
    }

    if (newPassword !== confirmPassword) {
        return { success: false, error: "Passwords do not match." };
    }

    if (newPassword.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword }
        });

        revalidatePath("/profile");
        return { success: true };
    } catch (error) {
        console.error("Failed to change password:", error);
        return { success: false, error: "An error occurred while updating your password." };
    }
}
