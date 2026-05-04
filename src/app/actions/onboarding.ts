"use server";

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";


export async function completeInviteSetup(formData: FormData) {
    const token = formData.get("token") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!token || !password || !confirmPassword) {
        return { success: false, error: "Please complete all required fields." };
    }

    if (password !== confirmPassword) {
        return { success: false, error: "Passwords do not match." };
    }

    if (password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters long." };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { inviteToken: token },
            select: { id: true, inviteTokenExpiresAt: true, isActive: true },
        });

        if (!user || !user.inviteTokenExpiresAt) {
            return { success: false, error: "Invite link is invalid." };
        }

        if (user.isActive) {
            return { success: false, error: "This account is already activated." };
        }

        if (user.inviteTokenExpiresAt < new Date()) {
            return { success: false, error: "Invite link has expired. Ask an admin to resend it." };
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                isActive: true,
                activatedAt: new Date(),
                inviteToken: null,
                inviteTokenExpiresAt: null,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to complete invite setup:", error);
        return { success: false, error: "Unable to activate account right now." };
    }
}
