"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import crypto from "crypto";


export async function addEmployee(formData: FormData) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized: Only Admins can add employees.");
    }

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const role = formData.get("role") as string;
    const pffdBalance = parseInt(formData.get("pffdBalance") as string, 10);

    if (!name || !email || !role || isNaN(pffdBalance)) {
        throw new Error("Missing required fields.");
    }

    try {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48);

        await prisma.user.create({
            data: {
                name,
                email,
                role,
                isActive: false,
                inviteToken,
                inviteTokenExpiresAt,
                invitedAt: new Date(),
                leaveBalances: {
                    create: {
                        leaveType: "LEAVE_CREDITS",
                        balance: pffdBalance
                    }
                }
            }
        });

        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const inviteLink = `${baseUrl}/setup-account?token=${inviteToken}`;

        revalidatePath("/admin/employees");
        return { success: true, inviteLink };
    } catch (error: any) {
        console.error("Failed to add employee:", error);
        return { success: false, error: "Email may already exist." };
    }
}

export async function deleteEmployee(userId: string) {
    const session = await auth();
    if (!session || !session.user || (session.user as any).role !== "ADMIN") {
        throw new Error("Unauthorized: Only Admins can delete employees.");
    }

    // Prevent deleting yourself
    if (userId === session.user.id) {
        return { success: false, error: "You cannot delete your own account." };
    }

    try {
        // Use a transaction to securely cascade delete all child records
        await prisma.$transaction([
            prisma.timeLog.deleteMany({ where: { userId } }),
            prisma.leaveBalance.deleteMany({ where: { userId } }),
            prisma.leaveRequest.deleteMany({ where: { userId } }),
            prisma.schedule.deleteMany({ where: { userId } }),
            prisma.auditLog.deleteMany({ where: { userId } }),
            // Remove them as a manager from any direct reports
            prisma.user.updateMany({ where: { managerId: userId }, data: { managerId: null } }),
            // Delete the authored content or reassign? We'll delete for now.
            prisma.announcement.deleteMany({ where: { authorId: userId } }),
            prisma.page.deleteMany({ where: { authorId: userId } }),
            // Finally delete the user
            prisma.user.delete({ where: { id: userId } })
        ]);

        revalidatePath("/admin/employees");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete employee:", error);
        return { success: false, error: "Database error occurred during deletion." };
    }
}
