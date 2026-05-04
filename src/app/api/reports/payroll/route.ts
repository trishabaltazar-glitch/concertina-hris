import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        // Authenticate
        const sessionAuth = request.headers.get('cookie');
        if (!sessionAuth) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const users = await prisma.user.findMany({
            where: { role: { in: ['EMPLOYEE', 'MANAGER'] } },
            include: {
                timeLogs: { orderBy: { clockIn: 'asc' } },
                leaveRequests: { where: { status: 'APPROVED' } }
            }
        });

        // Generate Consolidated Master CSV String
        let csvString = "==== CONCERTINA HR MASTER PAYROLL REPORT ====\n\n";
        
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
