import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileDown,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const ADMIN_VISIBLE_ROLES = ["EMPLOYEE", "MANAGER"];

type Tone = "default" | "success" | "warn" | "danger";

function MetricCard({
  label,
  value,
  helper,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone?: Tone;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-500/25 bg-rose-500/10"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/10"
        : tone === "success"
          ? "border-emerald-500/25 bg-emerald-500/10"
          : "border-border bg-background";

  return (
    <div className={cn("rounded-lg border p-4", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 border-t border-border/70 pt-3 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: Tone }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
      : tone === "warn"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : tone === "success"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/40 text-muted-foreground";

  return <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", toneClass)}>{children}</span>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

function getMissingProfileFields(user: {
  role: string;
  department: string | null;
  managerId: string | null;
  contactNumber: string | null;
  schedules: { id: string }[];
  leaveBalances: { balance: number }[];
}) {
  const fields = [];

  if (!user.department) fields.push("department");
  if (user.role !== "ADMIN" && !user.managerId) fields.push("manager");
  if (!user.contactNumber) fields.push("contact number");
  if (user.schedules.length === 0) fields.push("schedule");
  if (user.leaveBalances.length === 0) fields.push("PFFD balance");

  return fields;
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const currentUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !currentUser?.id || (currentUser.role !== "ADMIN" && currentUser.role !== "MANAGER")) {
    redirect("/login");
  }

  const isAdmin = currentUser.role === "ADMIN";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);
  const staleOpenLogCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const scopedUserWhere = isAdmin
    ? { role: { in: ADMIN_VISIBLE_ROLES } }
    : { managerId: currentUser.id, role: "EMPLOYEE" };

  const [users, todayLogs, openLogs, pendingRequests, scheduledToday, recentAuditLogs] = await Promise.all([
    prisma.user.findMany({
      where: scopedUserWhere,
      orderBy: { name: "asc" },
      include: {
        schedules: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true } },
        leaveBalances: { where: { leaveType: "LEAVE_CREDITS" }, select: { balance: true } },
        manager: { select: { name: true } },
      },
    }),
    prisma.timeLog.findMany({
      where: {
        clockIn: { gte: todayStart, lt: tomorrowStart },
        user: scopedUserWhere,
      },
      include: {
        breaks: { orderBy: { startedAt: "desc" }, take: 1 },
        user: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: { clockIn: "desc" },
    }),
    prisma.timeLog.findMany({
      where: {
        clockOut: null,
        user: scopedUserWhere,
      },
      include: {
        breaks: { orderBy: { startedAt: "desc" }, take: 1 },
        user: { select: { id: true, name: true, email: true, department: true } },
      },
      orderBy: { clockIn: "asc" },
      take: 25,
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "PENDING",
        user: scopedUserWhere,
      },
      include: { user: { select: { id: true, name: true, email: true, department: true, managerId: true } } },
      orderBy: { createdAt: "asc" },
      take: 25,
    }),
    prisma.schedule.findMany({
      where: {
        dayOfWeek: now.getDay(),
        user: { ...scopedUserWhere, isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            timeLogs: {
              where: { clockIn: { gte: todayStart, lt: tomorrowStart } },
              orderBy: { clockIn: "asc" },
              select: { clockIn: true, clockOut: true, status: true },
            },
          },
        },
      },
      orderBy: [{ startTime: "asc" }, { user: { name: "asc" } }],
      take: 50,
    }),
    prisma.auditLog.findMany({
      where: { user: scopedUserWhere },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const activeUsers = users.filter((user) => user.isActive);
  const activeUserIds = new Set(activeUsers.map((user) => user.id));
  const clockedInUserIds = new Set(todayLogs.map((log) => log.userId));
  const activeOpenLogs = openLogs.filter((log) => activeUserIds.has(log.userId));
  const onBreakLogs = activeOpenLogs.filter((log) => log.breaks.some((item) => !item.endedAt));
  const clockedOutToday = todayLogs.filter((log) => log.clockOut).length;
  const lateToday = todayLogs.filter((log) => log.status === "LATE").length;
  const notClockedIn = activeUsers.filter((user) => !clockedInUserIds.has(user.id)).length;
  const staleOpenLogs = openLogs.filter((log) => log.clockIn < staleOpenLogCutoff || log.clockIn < todayStart);

  const pendingInvites = users.filter((user) => user.inviteToken && user.inviteTokenExpiresAt && user.inviteTokenExpiresAt > now);
  const expiredInvites = users.filter((user) => user.inviteToken && user.inviteTokenExpiresAt && user.inviteTokenExpiresAt <= now);
  const inactiveEmployees = users.filter((user) => !user.isActive && !user.inviteToken);
  const dataQualityWarnings = users
    .map((user) => ({ user, fields: getMissingProfileFields(user) }))
    .filter((item) => item.fields.length > 0);

  const departments = Array.from(
    activeUsers.reduce((items, user) => {
      const department = user.department || "Unassigned";
      const item = items.get(department) ?? { department, active: 0, late: 0, pending: 0 };
      item.active += 1;
      items.set(department, item);
      return items;
    }, new Map<string, { department: string; active: number; late: number; pending: number }>()),
  ).map(([, value]) => value);

  for (const log of todayLogs) {
    const department = log.user.department || "Unassigned";
    const item = departments.find((entry) => entry.department === department);
    if (item && log.status === "LATE") item.late += 1;
  }

  for (const request of pendingRequests) {
    const department = request.user.department || "Unassigned";
    const item = departments.find((entry) => entry.department === department);
    if (item) item.pending += 1;
  }

  const managerWorkload = isAdmin
    ? await prisma.user.findMany({
        where: { role: "MANAGER", isActive: true },
        orderBy: { name: "asc" },
        include: {
          teamMembers: {
            select: {
              id: true,
              leaveRequests: { where: { status: "PENDING" }, select: { id: true } },
            },
          },
        },
        take: 8,
      })
    : [
        {
          id: currentUser.id,
          name: session.user?.name || "You",
          teamMembers: users.map((user) => ({
            id: user.id,
            leaveRequests: pendingRequests.filter((request) => request.userId === user.id).map((request) => ({ id: request.id })),
          })),
        },
      ];

  const needsAttention = [
    ...staleOpenLogs.slice(0, 4).map((log) => ({
      key: `clockout-${log.id}`,
      type: "Missing clock-out",
      person: log.user.name,
      detail: `Clocked in ${format(log.clockIn, "MMM d, h:mm a")}`,
      href: "/admin/timesheets",
      tone: "danger" as Tone,
    })),
    ...pendingRequests.slice(0, 4).map((request) => ({
      key: `pffd-${request.id}`,
      type: "PFFD approval",
      person: request.user.name,
      detail: `${format(request.startDate, "MMM d")} to ${format(request.endDate, "MMM d")}`,
      href: "/admin/leaves",
      tone: "warn" as Tone,
    })),
    ...dataQualityWarnings.slice(0, 4).map(({ user, fields }) => ({
      key: `quality-${user.id}`,
      type: "Data quality",
      person: user.name,
      detail: `Missing ${fields.slice(0, 3).join(", ")}`,
      href: "/admin/employees",
      tone: "default" as Tone,
    })),
  ].slice(0, 10);

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Administration
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live operational view for {format(now, "EEEE, MMM d")}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/employees">
              <UserPlus className="size-3.5" />
              Add employee
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/leaves">
              <FileCheck2 className="size-3.5" />
              Review PFFD
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active employees" value={activeUsers.length} helper={`${users.length} employees in scope`} icon={Users} tone="success" />
        <MetricCard label="Pending PFFD" value={pendingRequests.length} helper="Requests waiting for approval" icon={FileCheck2} tone={pendingRequests.length ? "warn" : "success"} />
        <MetricCard label="Late today" value={lateToday} helper={`${todayLogs.length} clock-ins recorded`} icon={Clock3} tone={lateToday ? "warn" : "success"} />
        <MetricCard label="Missing clock-outs" value={staleOpenLogs.length} helper={`${activeOpenLogs.length} active open logs`} icon={AlertTriangle} tone={staleOpenLogs.length ? "danger" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-lg border border-border bg-background">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
              <p className="mt-1 text-xs text-muted-foreground">Operational items that may block today or payroll cleanup.</p>
            </div>
            <StatusBadge tone={needsAttention.length ? "warn" : "success"}>{needsAttention.length} open</StatusBadge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Item</th>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Detail</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {needsAttention.length ? (
                  needsAttention.map((item) => (
                    <tr key={item.key} className="hover:bg-muted/30">
                      <td className="px-4 py-3"><StatusBadge tone={item.tone}>{item.type}</StatusBadge></td>
                      <td className="px-4 py-3 font-medium text-foreground">{item.person}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.detail}</td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={item.href}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState>No urgent admin items right now.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Today&apos;s attendance</h2>
            <p className="mt-1 text-xs text-muted-foreground">Current status across active employees in scope.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {[
              ["Clocked in", activeOpenLogs.length],
              ["Not clocked in", notClockedIn],
              ["On break", onBreakLogs.length],
              ["Clocked out", clockedOutToday],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="max-h-[260px] divide-y divide-border overflow-y-auto border-t border-border">
            {todayLogs.slice(0, 8).map((log) => {
              const isOnBreak = !log.clockOut && log.breaks.some((item) => !item.endedAt);
              return (
                <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{log.user.name}</p>
                    <p className="text-xs text-muted-foreground">{format(log.clockIn, "h:mm a")} - {log.clockOut ? format(log.clockOut, "h:mm a") : "active"}</p>
                  </div>
                  <StatusBadge tone={log.status === "LATE" ? "warn" : isOnBreak ? "default" : "success"}>
                    {isOnBreak ? "On break" : log.status === "LATE" ? "Late" : log.clockOut ? "Clocked out" : "Working"}
                  </StatusBadge>
                </div>
              );
            })}
            {todayLogs.length === 0 && <EmptyState>No time logs recorded today.</EmptyState>}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Schedule coverage today</h2>
            <p className="mt-1 text-xs text-muted-foreground">{scheduledToday.length} scheduled employees.</p>
          </div>
          <div className="divide-y divide-border">
            {scheduledToday.slice(0, 8).map((schedule) => {
              const firstLog = schedule.user.timeLogs[0];
              return (
                <div key={schedule.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{schedule.user.name}</p>
                      <p className="text-xs text-muted-foreground">{schedule.startTime} - {schedule.endTime}</p>
                    </div>
                    <StatusBadge tone={firstLog ? (firstLog.status === "LATE" ? "warn" : "success") : "danger"}>
                      {firstLog ? format(firstLog.clockIn, "h:mm a") : "Not in"}
                    </StatusBadge>
                  </div>
                </div>
              );
            })}
            {scheduledToday.length === 0 && <EmptyState>No schedules assigned for today.</EmptyState>}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Account setup</h2>
            <p className="mt-1 text-xs text-muted-foreground">Invite and activation status.</p>
          </div>
          <div className="grid gap-2 p-4">
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-muted-foreground">Pending invites</span>
              <span className="text-sm font-semibold text-foreground">{pendingInvites.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-muted-foreground">Expired invites</span>
              <span className="text-sm font-semibold text-foreground">{expiredInvites.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm text-muted-foreground">Inactive employees</span>
              <span className="text-sm font-semibold text-foreground">{inactiveEmployees.length}</span>
            </div>
          </div>
          <div className="border-t border-border p-4">
            <Button asChild className="w-full" variant="outline">
              <Link href="/admin/employees">
                <Send className="size-3.5" />
                Manage invites
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
            <p className="mt-1 text-xs text-muted-foreground">Common admin workflows.</p>
          </div>
          <div className="grid gap-2 p-4">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/schedules"><CalendarCheck className="size-4" />Manage schedules</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/reports"><FileDown className="size-4" />Export payroll</Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/admin/timesheets"><Clock3 className="size-4" />Review time logs</Link>
            </Button>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-background xl:col-span-2">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Team health by department</h2>
            <p className="mt-1 text-xs text-muted-foreground">Active headcount, lateness, and pending requests.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Active</th>
                  <th className="px-4 py-3 font-semibold">Late today</th>
                  <th className="px-4 py-3 font-semibold">Pending PFFD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departments.map((department) => (
                  <tr key={department.department}>
                    <td className="px-4 py-3 font-medium text-foreground">{department.department}</td>
                    <td className="px-4 py-3 text-muted-foreground">{department.active}</td>
                    <td className="px-4 py-3 text-muted-foreground">{department.late}</td>
                    <td className="px-4 py-3 text-muted-foreground">{department.pending}</td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={4}><EmptyState>No active employees in scope.</EmptyState></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Manager workload</h2>
            <p className="mt-1 text-xs text-muted-foreground">Direct reports and pending approvals.</p>
          </div>
          <div className="divide-y divide-border">
            {managerWorkload.map((manager) => {
              const pending = manager.teamMembers.reduce((sum, member) => sum + member.leaveRequests.length, 0);
              return (
                <div key={manager.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{manager.name}</p>
                    <p className="text-xs text-muted-foreground">{manager.teamMembers.length} direct reports</p>
                  </div>
                  <StatusBadge tone={pending ? "warn" : "success"}>{pending} pending</StatusBadge>
                </div>
              );
            })}
            {managerWorkload.length === 0 && <EmptyState>No manager workload to show.</EmptyState>}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Data quality warnings</h2>
            <p className="mt-1 text-xs text-muted-foreground">Profiles missing operational fields.</p>
          </div>
          <div className="divide-y divide-border">
            {dataQualityWarnings.slice(0, 8).map(({ user, fields }) => (
              <div key={user.id} className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">Missing {fields.join(", ")}</p>
              </div>
            ))}
            {dataQualityWarnings.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" />
                Employee setup data looks complete.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Recent admin activity</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest recorded changes and approvals.</p>
          </div>
          <div className="divide-y divide-border">
            {recentAuditLogs.map((log) => (
              <div key={log.id} className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{log.action.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.user.name} - {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                </p>
                {log.details && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{log.details}</p>}
              </div>
            ))}
            {recentAuditLogs.length === 0 && <EmptyState>No recent admin activity recorded.</EmptyState>}
          </div>
        </section>
      </div>
    </div>
  );
}
