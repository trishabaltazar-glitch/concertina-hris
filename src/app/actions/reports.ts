"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";


export async function generateTimesheetReport(startDate: string, endDate: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }

  const logs = await prisma.timeLog.findMany({
    where: {
      clockIn: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`),
      },
    },
    include: {
      user: true,
    },
    orderBy: [
      { user: { name: 'asc' } },
      { clockIn: 'asc' }
    ]
  });

  // Create CSV String
  let csv = "Employee Name,Email,Date,Clock In,Clock Out,Status\n";
  
  logs.forEach(log => {
    const clockInStr = log.clockIn ? new Date(log.clockIn).toISOString() : "";
    const clockOutStr = log.clockOut ? new Date(log.clockOut).toISOString() : "";
    
    csv += `"${log.user.name}","${log.user.email}",${new Date(log.clockIn).toISOString().split('T')[0]},${clockInStr},${clockOutStr},${log.status}\n`;
  });

  return csv;
}

export async function generateLeaveReport(startDate: string, endDate: string) {
  const session = await auth();
  const user = session?.user as any;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      startDate: {
        gte: new Date(`${startDate}T00:00:00.000Z`),
      },
      endDate: {
        lte: new Date(`${endDate}T23:59:59.999Z`),
      }
    },
    include: {
      user: true,
    },
    orderBy: [
      { startDate: 'asc' }
    ]
  });

  // Create CSV String
  let csv = "Employee Name,Email,Type,Start Date,End Date,Status,Reason\n";
  
  requests.forEach(req => {
    const reasonStr = req.reason ? `"${req.reason.replace(/"/g, '""')}"` : "";
    const typeStr = req.leaveType === "LEAVE_CREDITS" ? "PFFD Credits" : req.leaveType;
    
    csv += `"${req.user.name}","${req.user.email}",${typeStr},${new Date(req.startDate).toISOString().split('T')[0]},${new Date(req.endDate).toISOString().split('T')[0]},${req.status},${reasonStr}\n`;
  });

  return csv;
}
