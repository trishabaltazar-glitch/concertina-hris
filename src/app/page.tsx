import { ClockWidget } from "@/components/dashboard/clock-widget";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { endOfDay, endOfWeek, format, startOfDay, startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";
const BREAK_HOURS = 1;

type BreakWindow = {
  startedAt: Date;
  endedAt: Date | null;
};

function getBreakDurationInHours(breaks: BreakWindow[], fallbackEnd: Date | null) {
  return breaks.reduce((sum, item) => {
    const end = item.endedAt || fallbackEnd;
    if (!end) return sum;
    return sum + Math.max(0, (end.getTime() - item.startedAt.getTime()) / (1000 * 60 * 60));
  }, 0);
}

function getDurationInHours(clockIn: Date, clockOut: Date | null, breaks: BreakWindow[] = []) {
  if (!clockOut) return 0;
  const grossHours = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
  return Math.max(0, grossHours - getBreakDurationInHours(breaks, clockOut));
}

function getHoursAndMinutes(totalHours: number) {
  const safeHours = Math.max(0, totalHours);
  const hours = Math.floor(safeHours);
  const minutes = Math.round((safeHours - hours) * 60);

  if (minutes === 60) {
    return { hours: hours + 1, minutes: 0 };
  }

  return { hours, minutes };
}

function parseScheduleHours(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const minutes = Math.max(0, end - start);

  return Math.max(0, minutes / 60 - BREAK_HOURS);
}

function formatDurationParts(totalHours: number) {
  const { hours, minutes } = getHoursAndMinutes(totalHours);
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

function getDurationLabel(clockIn: Date, clockOut: Date | null, breaks: BreakWindow[] = []) {
  if (!clockOut) return "Ongoing";

  const diffInMinutes = Math.max(
    0,
    Math.round(getDurationInHours(clockIn, clockOut, breaks) * 60)
  );
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getStatusLabel(status: string) {
  if (status === "ON_TIME") return "On Time";
  if (status === "LATE") return "Late";
  return status.replaceAll("_", " ");
}

function getStatusClass(status: string) {
  if (status === "ON_TIME") {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (status === "LATE") {
    return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }

  return "bg-muted text-muted-foreground";
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const firstName = session.user.name ? session.user.name.split(" ")[0] : "there";

  const [balances, recentLogs, weeklyLogs, schedules] = await Promise.all([
    prisma.leaveBalance.findMany({
      where: { userId: session.user.id },
    }),
    prisma.timeLog.findMany({
      where: { userId: session.user.id },
      orderBy: { clockIn: "desc" },
      take: 5,
      select: {
        id: true,
        clockIn: true,
        clockOut: true,
        status: true,
        projectName: true,
        notes: true,
        breaks: {
          select: {
            startedAt: true,
            endedAt: true,
          },
        },
      },
    }),
    prisma.timeLog.findMany({
      where: {
        userId: session.user.id,
        clockIn: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: { clockIn: "desc" },
      select: {
        id: true,
        clockIn: true,
        clockOut: true,
        status: true,
        breaks: {
          select: {
            startedAt: true,
            endedAt: true,
          },
        },
      },
    }),
    prisma.schedule.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  const leaveCreditsBalance =
    balances.find((balance) => balance.leaveType === "LEAVE_CREDITS")?.balance || 0;

  const totalPlannedHours = schedules.reduce((sum, schedule) => {
    return sum + parseScheduleHours(schedule.startTime, schedule.endTime);
  }, 0);

  const totalWorkedHours = weeklyLogs.reduce((sum, log) => {
    return sum + getDurationInHours(log.clockIn, log.clockOut, log.breaks);
  }, 0);

  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const todayLogs = weeklyLogs.filter((log) => {
    return log.clockIn >= todayStart && log.clockIn <= todayEnd;
  });
  const todayWorkedHours = todayLogs.reduce((sum, log) => {
    return sum + getDurationInHours(log.clockIn, log.clockOut, log.breaks);
  }, 0);
  const latestTodayLog = todayLogs[0];

  const plannedDuration = formatDurationParts(totalPlannedHours);
  const workedDuration = formatDurationParts(totalWorkedHours);
  const todayDuration = formatDurationParts(todayWorkedHours);
  const remainingHours = Math.max(0, totalPlannedHours - totalWorkedHours);
  const overageHours = Math.max(0, totalWorkedHours - totalPlannedHours);
  const remainingDuration = formatDurationParts(remainingHours);
  const overageDuration = formatDurationParts(overageHours);
  const hasOverage = overageHours > 0;
  const completionPercent =
    totalPlannedHours > 0
      ? Math.min(100, Math.round((totalWorkedHours / totalPlannedHours) * 100))
      : 0;
  const remainingStatusLabel =
    totalPlannedHours === 0
      ? "No schedule"
      : hasOverage
        ? "Over schedule"
        : remainingHours === 0
          ? "Target met"
          : `${completionPercent}% complete`;
  const todayStatusLabel = latestTodayLog
    ? latestTodayLog.clockOut
      ? getStatusLabel(latestTodayLog.status)
      : "Active now"
    : "No logs today";

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <section className="rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Welcome
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {firstName}, here&apos;s your workday snapshot.
            </h1>
            <p className="text-xs text-muted-foreground">
              HR Manager | {format(now, "MMMM d, yyyy | h:mm a")}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </div>
        </div>

        <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          <ClockWidget />

          <div className="rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Remaining hours</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Left to complete based on this week&apos;s schedule
                </p>
              </div>
              <span className="rounded-md border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {remainingStatusLabel}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {hasOverage ? "Over schedule" : "Hours left"}
                </p>
                <div className="mt-1 flex items-end gap-1 text-foreground">
                  <span className="text-3xl font-semibold tracking-tight">
                    {hasOverage ? overageDuration.hours : remainingDuration.hours}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    hrs
                  </span>
                  <span className="text-xl font-semibold tracking-tight">
                    {hasOverage ? overageDuration.minutes : remainingDuration.minutes}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    mins
                  </span>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">Weekly progress</span>
                  <span className="text-muted-foreground">
                    {completionPercent}% of {plannedDuration.hours}h {plannedDuration.minutes}m
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${
                      hasOverage
                        ? "bg-amber-500"
                        : remainingHours === 0 && totalPlannedHours > 0
                          ? "bg-emerald-500"
                          : "bg-brand-red"
                    }`}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Days this week
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    {schedules.length}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Weekly target
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                    {plannedDuration.hours}h {plannedDuration.minutes}m
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Planned: {plannedDuration.hours}h {plannedDuration.minutes}m / Worked:{" "}
                {workedDuration.hours}h {workedDuration.minutes}m
                {hasOverage ? " / You are over the scheduled hours." : ""}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Logged this week</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total time recorded this week
                </p>
              </div>
              <span className="rounded-md border border-border/70 bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
                This week
              </span>
            </div>

            <div className="mt-4 rounded-lg bg-card px-4 py-5 text-center ring-1 ring-border/70">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Total hours
              </p>
              <div className="mt-2 flex items-end justify-center gap-1 text-foreground">
                <span className="text-3xl font-semibold tracking-tight">
                  {workedDuration.hours}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  hrs
                </span>
                <span className="text-xl font-semibold tracking-tight">
                  {workedDuration.minutes}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  mins
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Time entries
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {weeklyLogs.length}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Latest status
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                  {recentLogs[0] ? getStatusLabel(recentLogs[0].status) : "No logs"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Today
                </p>
                <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                  {todayStatusLabel}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {todayDuration.hours}h {todayDuration.minutes}m logged
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-card p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  PFFD balance
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {leaveCreditsBalance.toFixed(1).replace(".0", "")}
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Includes completed entries recorded during the current week.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Recent Time Logs
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Your latest activity
            </h2>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
            No recent logs to display today.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background/70">
            <div className="hidden grid-cols-[1.1fr_1fr_minmax(0,1.35fr)_110px_82px] gap-3 border-b border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:grid">
              <span>Date</span>
              <span>Time</span>
              <span>Details</span>
              <span className="text-right">Status</span>
              <span className="text-right">Duration</span>
            </div>
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 md:grid-cols-[1.1fr_1fr_minmax(0,1.35fr)_110px_82px] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Date
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {format(log.clockIn, "EEEE, MMM d")}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Time
                  </p>
                  <p className="text-xs text-muted-foreground md:text-sm md:text-foreground">
                    {format(log.clockIn, "h:mm a")} -{" "}
                    {log.clockOut ? format(log.clockOut, "h:mm a") : "Active"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Details
                  </p>
                  <p className="truncate text-xs text-muted-foreground md:text-sm">
                    {[log.projectName, log.notes].filter(Boolean).join(" | ") || "No details"}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Status
                  </p>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${getStatusClass(log.status)}`}
                  >
                    {getStatusLabel(log.status)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Duration
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {getDurationLabel(log.clockIn, log.clockOut, log.breaks)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
