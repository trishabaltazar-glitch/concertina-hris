import { NextResponse } from 'next/server';
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

type ReportSessionUser = {
    id: string;
    role: string;
};

const ADMIN_VISIBLE_ROLES = ["EMPLOYEE", "MANAGER"];

export async function GET(request: Request) {
    try {
        const session = await auth();
        const user = session?.user as ReportSessionUser | undefined;

        if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const url = new URL(request.url);
        const startDate = url.searchParams.get("startDate");
        const endDate = url.searchParams.get("endDate");
        const department = url.searchParams.get("department");
        const managerId = url.searchParams.get("managerId");
        const start = startDate ? new Date(`${startDate}T00:00:00.000Z`) : undefined;
        const end = endDate ? new Date(`${endDate}T23:59:59.999Z`) : undefined;

        const users = await prisma.user.findMany({
            where: {
                role: user.role === "ADMIN" ? { in: ADMIN_VISIBLE_ROLES } : "EMPLOYEE",
                ...(user.role === "ADMIN" ? {} : { managerId: user.id }),
                ...(department && department !== "ALL" ? { department } : {}),
                ...(managerId && managerId !== "ALL" ? { managerId } : {}),
            },
            include: {
                timeLogs: {
                    where: start && end ? { clockIn: { gte: start, lte: end } } : undefined,
                    orderBy: { clockIn: 'asc' }
                },
                leaveRequests: {
                    where: {
                        status: 'APPROVED',
                        ...(start && end ? { startDate: { lte: end }, endDate: { gte: start } } : {}),
                    }
                }
            }
        });

        // Generate Consolidated Master CSV String
        let csvString = "==== CONCERTINA HR MASTER PAYROLL REPORT ====\n";
        if (startDate && endDate) {
            csvString += `Period,${startDate} to ${endDate}\n`;
        }
        csvString += "\n";
        
        // 1. Attendance Summary Section
        csvString += "--- ATTENDANCE SUMMARY ---\n";
        csvString += "Employee Name,Email,Total Hours,Missing Clock-Outs,Late Logs,Approved PFFD Used\n";
        
        users.forEach(user => {
            let totalHoursRendered = 0;
            let missingOuts = 0;
            let lateLogs = 0;

            user.timeLogs.forEach(log => {
                if (log.status === 'LATE') lateLogs++;
                if (log.clockOut) {
                    const hoursWorked = (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / (1000 * 60 * 60);
                    totalHoursRendered += hoursWorked;
                } else {
                    missingOuts++;
                }
            });

            csvString += `"${user.name}","${user.email}","${totalHoursRendered.toFixed(2)}","${missingOuts}","${lateLogs}","${user.leaveRequests.length}"\n`;
        });

        csvString += "\n\n";

        // 2. Detailed Daily Logs Section
        csvString += "--- DETAILED DAILY LOGS ---\n";
        csvString += "Employee Name,Date,Clock In,Clock Out,Hours Worked,Status\n";

        users.forEach(user => {
            user.timeLogs.forEach(log => {
                const dateStr = new Date(log.clockIn).toLocaleDateString();
                const clockInStr = new Date(log.clockIn).toLocaleTimeString();
                let clockOutStr = 'MISSING';
                let hoursWorked = 0;

                if (log.clockOut) {
                    clockOutStr = new Date(log.clockOut).toLocaleTimeString();
                    hoursWorked = (new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / (1000 * 60 * 60);
                }

                csvString += `"${user.name}","${dateStr}","${clockInStr}","${clockOutStr}","${hoursWorked > 0 ? hoursWorked.toFixed(2) : 'N/A'}","${log.status}"\n`;
            });
        });

        return new NextResponse(csvString, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': 'attachment; filename="Master_Payroll_Export.csv"'
            }
        });

    } catch (error) {
        console.error('Error generating report:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
