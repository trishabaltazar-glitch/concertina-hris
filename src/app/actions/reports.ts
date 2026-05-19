"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { addDays, differenceInCalendarDays, differenceInMinutes, format, parseISO } from "date-fns";

type ReportFilters = {
  department?: string;
  managerId?: string;
};

type ReportSessionUser = {
  id: string;
  role: string;
};

type ReportUser = Awaited<ReturnType<typeof getReportUsers>>[number];

const STANDARD_DAY_MINUTES = 8 * 60;
const ADMIN_VISIBLE_ROLES = ["EMPLOYEE", "MANAGER"];

function csvEscape(value: string | number | null | undefined) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function getRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Invalid date range");
  }

  return { start, end };
}

async function requireReportUser() {
  const session = await auth();
  const user = session?.user as ReportSessionUser | undefined;

  if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    throw new Error("Unauthorized");
  }

  return user;
}

async function getReportUsers(currentUser: ReportSessionUser, filters: ReportFilters = {}) {
  return prisma.user.findMany({
    where: {
      role: currentUser.role === "ADMIN" ? { in: ADMIN_VISIBLE_ROLES } : "EMPLOYEE",
      ...(currentUser.role === "ADMIN" ? {} : { managerId: currentUser.id }),
      ...(filters.department && filters.department !== "ALL" ? { department: filters.department } : {}),
      ...(filters.managerId && filters.managerId !== "ALL" ? { managerId: filters.managerId } : {}),
    },
    include: {
      manager: { select: { id: true, name: true } },
      schedules: true,
    },
    orderBy: { name: "asc" },
  });
}

function getDatesInRange(startDate: string, endDate: string) {
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
  return Array.from({ length: days + 1 }, (_, index) => addDays(parseISO(startDate), index));
}

function getBreakMinutes(log: { breaks?: { startedAt: Date; endedAt: Date | null }[] }) {
  return (log.breaks ?? []).reduce((total, timeBreak) => {
    if (!timeBreak.endedAt) return total;
    return total + Math.max(0, differenceInMinutes(timeBreak.endedAt, timeBreak.startedAt));
  }, 0);
}

function getWorkedMinutes(log: { clockIn: Date; clockOut: Date | null; breaks?: { startedAt: Date; endedAt: Date | null }[] }) {
  if (!log.clockOut) return 0;
  return Math.max(0, differenceInMinutes(log.clockOut, log.clockIn) - getBreakMinutes(log));
}

function getScheduledMinutes(schedule?: { startTime: string; endTime: string } | null) {
  if (!schedule) return 0;

  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  return Math.max(0, endTotal - startTotal);
}

function getScheduleCompliance(scheduledDays: number, daysWithLogs: number, undertimeFlags: number) {
  if (scheduledDays === 0) return "No schedule";
  if (daysWithLogs === scheduledDays && undertimeFlags === 0) return "Compliant";
  return `${daysWithLogs}/${scheduledDays} scheduled days`;
}

function buildReportRows(
  users: ReportUser[],
  logs: Awaited<ReturnType<typeof prisma.timeLog.findMany>>,
  leaveRequests: Awaited<ReturnType<typeof prisma.leaveRequest.findMany>>,
  startDate: string,
  endDate: string,
) {
  const dates = getDatesInRange(startDate, endDate);
  const logsByUser = new Map<string, typeof logs>();
  const leavesByUser = new Map<string, typeof leaveRequests>();

  logs.forEach((log) => {
    const userLogs = logsByUser.get(log.userId) ?? [];
    userLogs.push(log);
    logsByUser.set(log.userId, userLogs);
  });

  leaveRequests.forEach((request) => {
    const userLeaves = leavesByUser.get(request.userId) ?? [];
    userLeaves.push(request);
    leavesByUser.set(request.userId, userLeaves);
  });

  const exceptions: {
    employeeName: string;
    email: string;
    department: string;
    managerName: string;
    date: string;
    type: string;
    detail: string;
    severity: "Blocked" | "Needs review";
  }[] = [];

  const employeeRows = users.map((employee) => {
    const employeeLogs = (logsByUser.get(employee.id) ?? []).sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
    const employeeLeaves = leavesByUser.get(employee.id) ?? [];
    const logDates = new Set(employeeLogs.map((log) => format(log.clockIn, "yyyy-MM-dd")));
    let totalMinutes = 0;
    let lateCount = 0;
    let missingClockOuts = 0;
    let undertimeFlags = 0;
    let scheduledDays = 0;
    let daysWithLogs = 0;

    employeeLogs.forEach((log, index) => {
      const dateLabel = format(log.clockIn, "yyyy-MM-dd");
      const schedule = employee.schedules.find((item) => item.dayOfWeek === log.clockIn.getUTCDay());
      const workedMinutes = getWorkedMinutes(log);
      const scheduledMinutes = getScheduledMinutes(schedule) || STANDARD_DAY_MINUTES;
      totalMinutes += workedMinutes;

      if (log.status === "LATE") {
        lateCount++;
        exceptions.push({
          employeeName: employee.name,
          email: employee.email,
          department: employee.department ?? "Unassigned",
          managerName: employee.manager?.name ?? "Unassigned",
          date: dateLabel,
          type: "Late",
          detail: `Clocked in at ${format(log.clockIn, "h:mm a")}`,
          severity: "Needs review",
        });
      }

      if (!log.clockOut) {
        missingClockOuts++;
        exceptions.push({
          employeeName: employee.name,
          email: employee.email,
          department: employee.department ?? "Unassigned",
          managerName: employee.manager?.name ?? "Unassigned",
          date: dateLabel,
          type: "Missing clock-out",
          detail: "Clock-in has no matching clock-out",
          severity: "Blocked",
        });
      } else if (workedMinutes < scheduledMinutes) {
        undertimeFlags++;
        exceptions.push({
          employeeName: employee.name,
          email: employee.email,
          department: employee.department ?? "Unassigned",
          managerName: employee.manager?.name ?? "Unassigned",
          date: dateLabel,
          type: "Undertime",
          detail: `${(workedMinutes / 60).toFixed(2)}h worked vs ${(scheduledMinutes / 60).toFixed(2)}h expected`,
          severity: "Needs review",
        });
      }

      const nextLog = employeeLogs[index + 1];
      if (log.clockOut && nextLog && nextLog.clockIn < log.clockOut) {
        exceptions.push({
          employeeName: employee.name,
          email: employee.email,
          department: employee.department ?? "Unassigned",
          managerName: employee.manager?.name ?? "Unassigned",
          date: dateLabel,
          type: "Overlapping logs",
          detail: `${format(log.clockIn, "h:mm a")} - ${format(log.clockOut, "h:mm a")} overlaps next log`,
          severity: "Blocked",
        });
      }
    });

    dates.forEach((date) => {
      const schedule = employee.schedules.find((item) => item.dayOfWeek === date.getUTCDay());
      if (!schedule) return;

      scheduledDays++;
      const dateKey = format(date, "yyyy-MM-dd");
      if (logDates.has(dateKey)) {
        daysWithLogs++;
        return;
      }

      exceptions.push({
        employeeName: employee.name,
        email: employee.email,
        department: employee.department ?? "Unassigned",
        managerName: employee.manager?.name ?? "Unassigned",
        date: dateKey,
        type: "No log on scheduled day",
        detail: `Scheduled ${schedule.startTime} - ${schedule.endTime}`,
        severity: "Blocked",
      });
    });

    const approvedPffdDays = employeeLeaves.reduce((total, request) => total + ((request as { requestedDays?: number }).requestedDays ?? 1), 0);

    return {
      employeeId: employee.id,
      employeeName: employee.name,
      email: employee.email,
      department: employee.department ?? "Unassigned",
      managerId: employee.managerId ?? "UNASSIGNED",
      managerName: employee.manager?.name ?? "Unassigned",
      totalHours: Number((totalMinutes / 60).toFixed(2)),
      lateCount,
      missingClockOuts,
      undertimeFlags,
      pffdDays: approvedPffdDays,
      scheduleCompliance: getScheduleCompliance(scheduledDays, daysWithLogs, undertimeFlags),
    };
  });

  const summary = employeeRows.reduce(
    (total, row) => ({
      totalHours: total.totalHours + row.totalHours,
      lateLogs: total.lateLogs + row.lateCount,
      missingClockOuts: total.missingClockOuts + row.missingClockOuts,
      undertimeFlags: total.undertimeFlags + row.undertimeFlags,
      pffdDays: total.pffdDays + row.pffdDays,
    }),
    { totalHours: 0, lateLogs: 0, missingClockOuts: 0, undertimeFlags: 0, pffdDays: 0 },
  );

  const blockedExceptions = exceptions.filter((exception) => exception.severity === "Blocked").length;
  const readinessStatus = blockedExceptions > 0 ? "Blocked" : exceptions.length > 0 ? "Needs review" : "Ready";

  return {
    summary: {
      ...summary,
      totalHours: Number(summary.totalHours.toFixed(2)),
      pffdDays: Number(summary.pffdDays.toFixed(2)),
      employees: employeeRows.length,
      exceptions: exceptions.length,
      readinessStatus,
    },
    employeeRows,
    exceptions,
  };
}

export async function getReportPreview(startDate: string, endDate: string, filters: ReportFilters = {}) {
  const user = await requireReportUser();
  const { start, end } = getRange(startDate, endDate);
  const users = await getReportUsers(user, filters);
  const userIds = users.map((employee) => employee.id);

  const logs = await prisma.timeLog.findMany({
    where: {
      userId: { in: userIds },
      clockIn: { gte: start, lte: end },
    },
    include: { breaks: true },
    orderBy: [{ userId: "asc" }, { clockIn: "asc" }],
  });

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: {
      userId: { in: userIds },
      status: "APPROVED",
      leaveType: "LEAVE_CREDITS",
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      action: { in: ["PFFD_APPROVED", "PFFD_REJECTED", "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "SCHEDULE_UPDATED"] },
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const filterUsers = await getReportUsers(user);

  const report = buildReportRows(users, logs, leaveRequests, startDate, endDate);
  const departments = Array.from(new Set(filterUsers.map((employee) => employee.department).filter(Boolean) as string[])).sort();
  const managers = Array.from(
    new Map(
      filterUsers
        .filter((employee) => employee.manager)
        .map((employee) => [employee.manager!.id, { id: employee.manager!.id, name: employee.manager!.name }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...report,
    filters: {
      departments,
      managers,
    },
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.user.name,
      details: log.details ?? "",
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function generateEmployeeSummaryReport(startDate: string, endDate: string, filters: ReportFilters = {}) {
  const preview = await getReportPreview(startDate, endDate, filters);
  return toCsv([
    ["Employee Name", "Email", "Department", "Manager", "Total Hours", "Late Count", "Missing Clock-Outs", "Undertime Flags", "PFFD Days", "Schedule Compliance"],
    ...preview.employeeRows.map((row) => [
      row.employeeName,
      row.email,
      row.department,
      row.managerName,
      row.totalHours,
      row.lateCount,
      row.missingClockOuts,
      row.undertimeFlags,
      row.pffdDays,
      row.scheduleCompliance,
    ]),
  ]);
}

export async function generateExceptionReport(startDate: string, endDate: string, filters: ReportFilters = {}) {
  const preview = await getReportPreview(startDate, endDate, filters);
  return toCsv([
    ["Employee Name", "Email", "Department", "Manager", "Date", "Exception Type", "Severity", "Details"],
    ...preview.exceptions.map((exception) => [
      exception.employeeName,
      exception.email,
      exception.department,
      exception.managerName,
      exception.date,
      exception.type,
      exception.severity,
      exception.detail,
    ]),
  ]);
}

export async function generateTimesheetReport(startDate: string, endDate: string, filters: ReportFilters = {}) {
  const user = await requireReportUser();

  const logs = await prisma.timeLog.findMany({
    where: {
      user: {
        role: user.role === "ADMIN" ? { in: ADMIN_VISIBLE_ROLES } : "EMPLOYEE",
        ...(user.role === "ADMIN" ? {} : { managerId: user.id }),
        ...(filters.department && filters.department !== "ALL" ? { department: filters.department } : {}),
        ...(filters.managerId && filters.managerId !== "ALL" ? { managerId: filters.managerId } : {}),
      },
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

export async function generateLeaveReport(startDate: string, endDate: string, filters: ReportFilters = {}) {
  const user = await requireReportUser();

  const requests = await prisma.leaveRequest.findMany({
    where: {
      user: {
        role: user.role === "ADMIN" ? { in: ADMIN_VISIBLE_ROLES } : "EMPLOYEE",
        ...(user.role === "ADMIN" ? {} : { managerId: user.id }),
        ...(filters.department && filters.department !== "ALL" ? { department: filters.department } : {}),
        ...(filters.managerId && filters.managerId !== "ALL" ? { managerId: filters.managerId } : {}),
      },
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
