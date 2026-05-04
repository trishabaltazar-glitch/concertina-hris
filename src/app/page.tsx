import { ClockWidget } from "@/components/dashboard/clock-widget";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { endOfWeek, format, startOfWeek } from "date-fns";

export const dynamic = "force-dynamic";

function getDurationInHours(clockIn: Date, clockOut: Date | null) {
  if (!clockOut) return 0;
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
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

  return minutes / 60;
}

function formatDurationParts(totalHours: number) {
  const { hours, minutes } = getHoursAndMinutes(totalHours);
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

function getDurationLabel(clockIn: Date, clockOut: Date | null) {
  if (!clockOut) return "Ongoing";

  const diffInMinutes = Math.max(
    0,
    Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
  );
  const hours = Math.floor(diffInMinutes / 60);
  const minutes = diffInMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
    return sum + getDurationInHours(log.clockIn, log.clockOut);
  }, 0);

  const plannedDuration = formatDurationParts(totalPlannedHours);
  const workedDuration = formatDurationParts(totalWorkedHours);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="rounded-[28px] border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Welcome
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {firstName}, here&apos;s your workday snapshot.
            </h1>
            <p className="text-sm text-muted-foreground">
              HR Manager | {format(now, "MMMM d, yyyy | h:mm a")}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.95fr)]">
          <ClockWidget />

          <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Planned hours</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on your assigned weekly schedule
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Weekly
              </span>
            </div>

            <div className="mt-8 space-y-6">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Total hours
                </p>
                <div className="mt-2 flex items-end gap-1 text-foreground">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plannedDuration.hours}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    hrs
                  </span>
                  <span className="text-2xl font-semibold tracking-tight">
                    {plannedDuration.minutes}
                  </span>
                  <span className="pb-1 text-sm font-medium text-muted-foreground">
                    mins
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Days this week
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {schedules.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    PFFD balance
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {leaveCreditsBalance.toFixed(1).replace(".0", "")}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Each employee should complete their total weekly planned hours
                based on their assigned work schedule.
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-background/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Worked hours</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total time logged for this week
                </p>
              </div>
              <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                Until today
              </span>
            </div>

            <div className="mt-8 rounded-3xl bg-card px-6 py-8 text-center ring-1 ring-border/70">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Total hours
              </p>
              <div className="mt-3 flex items-end justify-center gap-1 text-foreground">
                <span className="text-4xl font-semibold tracking-tight">
                  {workedDuration.hours}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  hrs
                </span>
                <span className="text-2xl font-semibold tracking-tight">
                  {workedDuration.minutes}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  mins
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Entries this week
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {weeklyLogs.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Latest status
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                  {recentLogs[0]
                    ? recentLogs[0].status === "ON_TIME"
                      ? "On Time"
                      : recentLogs[0].status === "LATE"
                        ? "Late"
                        : recentLogs[0].status.replaceAll("_", " ")
                    : "No logs"}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              The total time an employee worked, including completed time logs
              recorded during the current week.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Recent Time Logs
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Your latest activity
            </h2>
          </div>
        </div>

        {recentLogs.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border/80 bg-muted/35 px-4 py-10 text-center text-sm text-muted-foreground">
            No recent logs to display today.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/70 px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    {format(log.clockIn, "EEEE, MMM d")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {format(log.clockIn, "h:mm a")} to{" "}
                    {log.clockOut ? format(log.clockOut, "h:mm a") : "Active"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      log.status === "ON_TIME"
                        ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                        : log.status === "LATE"
                          ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {log.status === "ON_TIME"
                      ? "On Time"
                      : log.status === "LATE"
                        ? "Late"
                        : log.status.replaceAll("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {getDurationLabel(log.clockIn, log.clockOut)}
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
