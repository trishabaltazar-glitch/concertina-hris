"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import crypto from "crypto";
import { sendInviteEmail } from "@/lib/invite-email";

const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN"] as const;

function cleanText(value: FormDataEntryValue | null) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || null;
}

function cleanRequiredText(value: FormDataEntryValue | null) {
    const text = cleanText(value);
    return text || "";
}

function getBaseUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
}

async function requireAdmin() {
    const session = await auth();
    const user = session?.user as any;

    if (!session || !user || user.role !== "ADMIN") {
        throw new Error("Unauthorized: Only Admins can manage employees.");
    }

    return user as { id: string; role: string };
}

async function logEmployeeAction(actorId: string, action: string, details: Record<string, unknown>) {
    await prisma.auditLog.create({
        data: {
            action,
            userId: actorId,
            details: JSON.stringify(details),
        },
    });
}

async function validateManager(managerId: string | null, employeeId?: string) {
    if (!managerId) return null;

    if (employeeId && managerId === employeeId) {
        return { error: "An employee cannot be assigned as their own manager." };
    }

    const manager = await prisma.user.findUnique({
        where: { id: managerId },
        select: { id: true, role: true, isActive: true },
    });

    if (!manager || manager.role !== "MANAGER" || !manager.isActive) {
        return { error: "Select an active manager." };
    }

    return { managerId };
}

export async function addEmployee(formData: FormData) {
    const actor = await requireAdmin();

    const name = cleanRequiredText(formData.get("name"));
    const email = cleanRequiredText(formData.get("email")).toLowerCase();
    const role = cleanRequiredText(formData.get("role"));
    const pffdBalance = parseInt(formData.get("pffdBalance") as string, 10);
    const position = cleanText(formData.get("position"));
    const department = cleanText(formData.get("department"));
    const managerId = cleanText(formData.get("managerId"));

    if (!name || !email || !ROLES.includes(role as any) || isNaN(pffdBalance)) {
        throw new Error("Missing required fields.");
    }

    const managerResult = await validateManager(managerId);
    if (managerResult?.error) {
        return { success: false, error: managerResult.error };
    }

    try {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48);

        await prisma.user.create({
            data: {
                name,
                email,
                role,
                position,
                department,
                managerId: managerResult?.managerId || null,
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

        await logEmployeeAction(actor.id, "EMPLOYEE_CREATED", { email, role, department, managerId: managerResult?.managerId || null });

        const inviteLink = `${getBaseUrl()}/setup-account?token=${inviteToken}`;
        const emailResult = await sendInviteEmail({ to: email, name, inviteUrl: inviteLink });

        revalidatePath("/admin/employees");
        revalidatePath("/directory");
        return { success: true, inviteLink, emailSent: emailResult.sent };
    } catch (error: any) {
        console.error("Failed to add employee:", error);
        return { success: false, error: "Email may already exist." };
    }
}

export async function updateEmployeeProfile(userId: string, formData: FormData) {
    const actor = await requireAdmin();

    const name = cleanRequiredText(formData.get("name"));
    const email = cleanRequiredText(formData.get("email")).toLowerCase();
    const role = cleanRequiredText(formData.get("role"));
    const position = cleanText(formData.get("position"));
    const department = cleanText(formData.get("department"));
    const contactNumber = cleanText(formData.get("contactNumber"));
    const emergencyContact = cleanText(formData.get("emergencyContact"));
    const address = cleanText(formData.get("address"));
    const icId = cleanText(formData.get("icId"));
    const managerId = cleanText(formData.get("managerId"));

    if (!userId || !name || !email || !ROLES.includes(role as any)) {
        return { success: false, error: "Enter valid employee details." };
    }

    const managerResult = await validateManager(managerId, userId);
    if (managerResult?.error) {
        return { success: false, error: managerResult.error };
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                name,
                email,
                role,
                position,
                department,
                contactNumber,
                emergencyContact,
                address,
                icId,
                managerId: managerResult?.managerId || null,
            },
        });

        await logEmployeeAction(actor.id, "EMPLOYEE_PROFILE_UPDATED", {
            targetUserId: userId,
            email,
            role,
            department,
            managerId: managerResult?.managerId || null,
        });

        revalidatePath("/admin/employees");
        revalidatePath("/directory");
        revalidatePath("/profile");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update employee:", error);
        return { success: false, error: "Failed to update employee. The email may already be in use." };
    }
}

export async function deleteEmployee(userId: string) {
    const actor = await requireAdmin();

    // Prevent deleting yourself
    if (userId === actor.id) {
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

export async function deactivateEmployee(userId: string) {
    const actor = await requireAdmin();

    if (userId === actor.id) {
        return { success: false, error: "You cannot deactivate your own account." };
    }

    try {
        await prisma.$transaction([
            prisma.user.updateMany({ where: { managerId: userId }, data: { managerId: null } }),
            prisma.user.update({
                where: { id: userId },
                data: {
                    isActive: false,
                    inviteToken: null,
                    inviteTokenExpiresAt: null,
                },
            }),
            prisma.auditLog.create({
                data: {
                    action: "EMPLOYEE_DEACTIVATED",
                    userId: actor.id,
                    details: JSON.stringify({ targetUserId: userId }),
                },
            }),
        ]);

        revalidatePath("/admin/employees");
        revalidatePath("/directory");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to deactivate employee:", error);
        return { success: false, error: "Failed to deactivate employee." };
    }
}

export async function reactivateEmployee(userId: string) {
    const actor = await requireAdmin();

    try {
        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });

        if (!employee) {
            return { success: false, error: "Employee not found." };
        }

        if (!employee.password) {
            return { success: false, error: "This employee has not set up a password yet. Resend their invite instead." };
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                isActive: true,
                activatedAt: new Date(),
                inviteToken: null,
                inviteTokenExpiresAt: null,
            },
        });

        await logEmployeeAction(actor.id, "EMPLOYEE_REACTIVATED", { targetUserId: userId });

        revalidatePath("/admin/employees");
        revalidatePath("/directory");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to reactivate employee:", error);
        return { success: false, error: "Failed to reactivate employee." };
    }
}

export async function resendEmployeeInvite(userId: string) {
    const actor = await requireAdmin();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, isActive: true },
    });

    if (!user) {
        return { success: false, error: "Employee not found." };
    }

    if (user.isActive) {
        return { success: false, error: "This employee is already active." };
    }

    try {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 48);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                inviteToken,
                inviteTokenExpiresAt,
                invitedAt: new Date(),
            },
        });

        const inviteLink = `${getBaseUrl()}/setup-account?token=${inviteToken}`;
        const emailResult = await sendInviteEmail({ to: user.email, name: user.name, inviteUrl: inviteLink });

        await logEmployeeAction(actor.id, "EMPLOYEE_INVITE_RESENT", { targetUserId: userId, email: user.email });

        revalidatePath("/admin/employees");
        return { success: true, inviteLink, emailSent: emailResult.sent };
    } catch (error: any) {
        console.error("Failed to resend invite:", error);
        return { success: false, error: "Failed to resend invite." };
    }
}

export async function bulkUpdateEmployees(userIds: string[], updates: { department?: string; managerId?: string; role?: string }) {
    const actor = await requireAdmin();

    const uniqueUserIds = Array.from(new Set(userIds)).filter(Boolean);
    if (uniqueUserIds.length === 0) {
        return { success: false, error: "Select at least one employee." };
    }

    const data: { department?: string | null; managerId?: string | null; role?: string } = {};

    if ("department" in updates) {
        data.department = updates.department?.trim() || null;
    }

    if ("role" in updates) {
        if (!updates.role || !ROLES.includes(updates.role as any)) {
            return { success: false, error: "Select a valid role." };
        }
        data.role = updates.role;
    }

    if ("managerId" in updates) {
        const managerId = updates.managerId?.trim() || null;
        const managerResult = await validateManager(managerId);
        if (managerResult?.error) {
            return { success: false, error: managerResult.error };
        }
        data.managerId = managerResult?.managerId || null;
    }

    if (Object.keys(data).length === 0) {
        return { success: false, error: "Choose a bulk update to apply." };
    }

    try {
        await prisma.user.updateMany({
            where: { id: { in: uniqueUserIds }, NOT: { id: actor.id } },
            data,
        });

        await logEmployeeAction(actor.id, "EMPLOYEES_BULK_UPDATED", { targetUserIds: uniqueUserIds, updates: data });

        revalidatePath("/admin/employees");
        revalidatePath("/directory");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to bulk update employees:", error);
        return { success: false, error: "Failed to update selected employees." };
    }
}

export async function updateEmployeePffdBalance(userId: string, balance: number) {
    const actor = await requireAdmin();

    if (!userId || !Number.isFinite(balance) || balance < 0) {
        return { success: false, error: "Enter a valid PFFD balance." };
    }

    try {
        await prisma.leaveBalance.upsert({
            where: {
                userId_leaveType: {
                    userId,
                    leaveType: "LEAVE_CREDITS",
                },
            },
            update: { balance },
            create: {
                userId,
                leaveType: "LEAVE_CREDITS",
                balance,
            },
        });

        await logEmployeeAction(actor.id, "EMPLOYEE_PFFD_BALANCE_UPDATED", { targetUserId: userId, balance });

        revalidatePath("/admin/employees");
        revalidatePath("/");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update PFFD balance:", error);
        return { success: false, error: "Failed to update PFFD balance." };
    }
}
