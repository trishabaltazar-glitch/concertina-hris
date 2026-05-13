import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { EmployeeClientPage } from "./components/employee-client-page";


export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
    // Fetch all users with their primary leave balance
    const users = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        include: {
            leaveBalances: {
                where: { leaveType: 'LEAVE_CREDITS' }
            }
        }
    });

    // Flatten data for the client component
    const formattedUsers = users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        leaveBalance: u.leaveBalances[0]?.balance || 0,
        joined: format(u.createdAt, 'MMM d, yyyy')
    }));

    return (
        <div className="w-full space-y-8">
            <EmployeeClientPage initialUsers={formattedUsers} />
        </div>
    );
}
