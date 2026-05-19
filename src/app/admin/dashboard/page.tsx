import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  Clock3,
  FileCheck2,
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
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2.5 text-xs text-muted-foreground">{helper}</p>
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

  const users = await prisma.user.findMany({
    where: scopedUserWhere,
    orderBy: { name: "asc" },
    select: {
      id: true,
      department: true,
      isActive: true,
    },
  });

  const todayLogs = await prisma.timeLog.findMany({
    where: {
      clockIn: { gte: todayStart, lt: tomorrowStart },
      user: scopedUserWhere,
    },
    include: {
      breaks: { orderBy: { startedAt: "desc" }, take: 1 },
      user: { select: { id: true, name: true, email: true, department: true } },
    },
    orderBy: { clockIn: "desc" },
  });

  const openLogs = await prisma.timeLog.findMany({
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
  });

  const pendingRequests = await prisma.leaveRequest.findMany({
    where: {
      status: "PENDING",
      user: scopedUserWhere,
    },
    include: { user: { select: { id: true, name: true, email: true, department: true, managerId: true } } },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  const scheduledToday = await prisma.schedule.findMany({
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
  });

  const activeUsers = users.filter((user) => user.isActive);
  const activeUserIds = new Set(activeUsers.map((user) => user.id));
  const clockedInUserIds = new Set(todayLogs.map((log) => log.userId));
  const activeOpenLogs = openLogs.filter((log) => activeUserIds.has(log.userId));
  const onBreakLogs = activeOpenLogs.filter((log) => log.breaks.some((item) => !item.endedAt));
  const clockedOutToday = todayLogs.filter((log) => log.clockOut).length;
  const lateToday = todayLogs.filter((log) => log.status === "LATE").length;
  const notClockedIn = activeUsers.filter((user) => !clockedInUserIds.has(user.id)).length;
  const staleOpenLogs = openLogs.filter((log) => log.clockIn < staleOpenLogCutoff || log.clockIn < todayStart);

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
  ].slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin workspace
          </span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational snapshot for {format(now, "EEEE, MMM d")}.
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
            <Link href="/admin/approvals">
              <FileCheck2 className="size-3.5" />
              Review approvals
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active employees" value={activeUsers.length} helper={`${users.length} people in scope`} icon={Users} tone="success" />
        <MetricCard label="Pending PFFD" value={pendingRequests.length} helper="Waiting for review" icon={FileCheck2} tone={pendingRequests.length ? "warn" : "success"} />
        <MetricCard label="Late today" value={lateToday} helper={`${todayLogs.length} clock-ins recorded`} icon={Clock3} tone={lateToday ? "warn" : "success"} />
        <MetricCard label="Missing clock-outs" value={staleOpenLogs.length} helper={`${activeOpenLogs.length} active open logs`} icon={AlertTriangle} tone={staleOpenLogs.length ? "danger" : "success"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <section className="rounded-lg border border-border/70 bg-background shadow-sm xl:col-span-7">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Today&apos;s attendance</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Live status across active employees in scope.</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/timesheets">View time logs</Link>
            </Button>
          </div>
          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-4">
            {[
              ["Clocked in", activeOpenLogs.length],
              ["Not clocked in", notClockedIn],
              ["On break", onBreakLogs.length],
              ["Clocked out", clockedOutToday],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="max-h-[300px] divide-y divide-border overflow-y-auto">
            {todayLogs.slice(0, 8).map((log) => {
              const isOnBreak = !log.clockOut && log.breaks.some((item) => !item.endedAt);
              return (
                <div key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
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

        <section className="rounded-lg border border-border/70 bg-background shadow-sm xl:col-span-5">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Needs attention</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Action items blocking cleanup.</p>
            </div>
            <StatusBadge tone={needsAttention.length ? "warn" : "success"}>{needsAttention.length} open</StatusBadge>
          </div>
          <div className="grid gap-2.5 p-3">
            {needsAttention.length ? (
              needsAttention.map((item) => (
                <div key={item.key} className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <StatusBadge tone={item.tone}>{item.type}</StatusBadge>
                    <div>
                      <p className="truncate text-sm font-semibold text-foreground">{item.person}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link href={item.href}>Open</Link>
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No urgent admin items right now.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-background shadow-sm xl:col-span-5">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Schedule coverage today</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{scheduledToday.length} scheduled employees.</p>
          </div>
          <div className="divide-y divide-border">
            {scheduledToday.slice(0, 8).map((schedule) => {
              const firstLog = schedule.user.timeLogs[0];
              return (
                <div key={schedule.id} className="px-4 py-2.5">
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

        <section className="rounded-lg border border-border/70 bg-background shadow-sm xl:col-span-7">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">Department summary</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Active headcount, lateness, and pending requests.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Department</th>
                  <th className="px-4 py-2.5 font-semibold">Active</th>
                  <th className="px-4 py-2.5 font-semibold">Late today</th>
                  <th className="px-4 py-2.5 font-semibold">Pending PFFD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {departments.map((department) => (
                  <tr key={department.department}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{department.department}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{department.active}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{department.late}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{department.pending}</td>
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
      </div>
    </div>
  );
}
