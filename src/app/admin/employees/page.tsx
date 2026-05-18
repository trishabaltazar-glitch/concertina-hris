import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmployeeClientPage } from "./components/employee-client-page";


export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
    const session = await auth();
    const currentUser = session?.user as any;

    if (!session || !currentUser || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
        redirect("/login");
    }

    const isAdmin = currentUser.role === "ADMIN";

    const users = await prisma.user.findMany({
        where: isAdmin ? undefined : { managerId: currentUser.id },
        orderBy: { name: 'asc' },
        include: {
            manager: {
                select: { id: true, name: true },
            },
            teamMembers: {
                select: { id: true },
            },
            leaveBalances: {
                where: { leaveType: 'LEAVE_CREDITS' }
            }
        }
    });

    const managers = isAdmin
        ? await prisma.user.findMany({
            where: {
                role: "MANAGER",
                isActive: true,
            },
            orderBy: { name: "asc" },
            select: { id: true, name: true, email: true },
        })
        : [];

    const formattedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        position: u.position,
        department: u.department,
        contactNumber: u.contactNumber,
        emergencyContact: u.emergencyContact,
        address: u.address,
        icId: u.icId,
        managerId: u.managerId,
        managerName: u.manager?.name ?? null,
        directReportCount: u.teamMembers.length,
        isActive: u.isActive,
        invitedAt: u.invitedAt ? format(u.invitedAt, 'MMM d, yyyy') : null,
        activatedAt: u.activatedAt ? format(u.activatedAt, 'MMM d, yyyy') : null,
        inviteTokenExpiresAt: u.inviteTokenExpiresAt ? u.inviteTokenExpiresAt.toISOString() : null,
        hasPendingInvite: Boolean(u.inviteToken && u.inviteTokenExpiresAt && u.inviteTokenExpiresAt > new Date()),
        leaveBalance: u.leaveBalances[0]?.balance || 0,
        joined: format(u.createdAt, 'MMM d, yyyy')
    }));

    return (
        <div className="w-full space-y-8">
            <EmployeeClientPage
                initialUsers={formattedUsers}
                managers={managers}
                currentUserRole={currentUser.role}
            />
        </div>
    );
}
