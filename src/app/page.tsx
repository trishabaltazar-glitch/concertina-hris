import { ClockWidget } from "@/components/dashboard/clock-widget";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { endOfDay, format, startOfDay } from "date-fns";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

type BreakWindow = {
  startedAt: Date;
  endedAt: Date | null;
};

type ScheduleWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ScheduleOverrideWindow = {
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
};

type AssignedHoliday = {
  id: string;
  name: string;
  date: Date;
  notes: string | null;
};

type AttendanceActivity = {
  id: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  happenedAt: Date;
  label: string;
  detail: string;
  duration: string | null;
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

function applyTimeToDate(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
}

function getScheduleWindowForDate(date: Date, schedule: ScheduleWindow) {
  const start = applyTimeToDate(date, schedule.startTime);
  const end = applyTimeToDate(date, schedule.endTime);

  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

function getShiftWindowForLog(
  clockIn: Date,
  clockOut: Date | null,
  schedules: ScheduleWindow[]
) {
  const fallback = { start: startOfDay(clockIn), end: endOfDay(clockIn) };
  const referenceEnd = clockOut || clockIn;

  for (const schedule of schedules) {
    for (const offset of [-1, 0, 1]) {
      const date = startOfDay(clockIn);
      date.setDate(date.getDate() + offset);

      if (date.getDay() !== schedule.dayOfWeek) continue;

      const window = getScheduleWindowForDate(date, schedule);
      const overlapsShift = clockIn < window.end && referenceEnd >= window.start;

      if (overlapsShift) {
        return window;
      }
    }
  }

  return fallback;
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

function formatDurationParts(totalHours: number) {
  const { hours, minutes } = getHoursAndMinutes(totalHours);
  return { hours: String(hours), minutes: String(minutes).padStart(2, "0") };
}

function getDurationLabel(clockIn: Date, clockOut: Date | null, breaks: BreakWindow[] = []) {
  if (!clockOut) return "-";

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

function formatScheduleTime(time?: string) {
  if (!time) return "";
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return format(new Date(2025, 0, 1, hours, minutes), minutes === 0 ? "h a" : "h:mm a");
}

function getScheduleHoursLabel(schedule?: { startTime: string; endTime: string } | null) {
  if (!schedule) return "";

  const [startHours, startMinutes] = schedule.startTime.split(":").map(Number);
  const [endHours, endMinutes] = schedule.endTime.split(":").map(Number);

  if ([startHours, startMinutes, endHours, endMinutes].some(Number.isNaN)) return "";

  const startTotalMinutes = startHours * 60 + startMinutes;
  let endTotalMinutes = endHours * 60 + endMinutes;
  if (endTotalMinutes <= startTotalMinutes) endTotalMinutes += 24 * 60;

  const hours = (endTotalMinutes - startTotalMinutes) / 60;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1).replace(".0", "")} hours`;
}

function getStatusLabel(status: string) {
  if (status === "ON_TIME") return "On Time";
  if (status === "LATE") return "Late";
  if (status === "FORCED_CHECKOUT") return "Auto clock-out";
  return status.replaceAll("_", " ");
}

function getActivityClass(type: "CLOCK_IN" | "CLOCK_OUT") {
  return type === "CLOCK_IN"
    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
    : "bg-brand-steel/12 text-brand-steel dark:text-sky-300";
}

function getClockOutDetail(
  log: { clockIn: Date; clockOut: Date; breaks: BreakWindow[] },
  logs: { clockIn: Date; clockOut: Date | null; breaks: BreakWindow[] }[],
  schedules: ScheduleWindow[]
) {
  const shiftWindow = getShiftWindowForLog(log.clockIn, log.clockOut, schedules);
  const completedHoursForShift = logs.reduce((sum, item) => {
    if (!item.clockOut) return sum;
    if (item.clockIn >= shiftWindow.end || item.clockOut <= shiftWindow.start) return sum;
    if (item.clockOut > log.clockOut) return sum;
    return sum + getDurationInHours(item.clockIn, item.clockOut, item.breaks);
  }, 0);

  return completedHoursForShift >= 8
    ? "Shift completed"
    : "Partial shift";
}

function formatRoleLabel(role?: string | null) {
  if (!role) return "Employee";

  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const firstName = session.user.name?.trim().split(/\s+/)[0] || "there";
  const roleLabel = formatRoleLabel((session.user as { role?: string | null }).role);
  await ensureScheduleOverrideTable();

  const recentLogs = await prisma.timeLog.findMany({
    where: { userId: session.user.id },
    orderBy: { clockIn: "desc" },
    take: 5,
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
  });

  const todayLogs = await prisma.timeLog.findMany({
    where: {
      userId: session.user.id,
      clockIn: {
        gte: todayStart,
        lte: todayEnd,
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
  });

  const schedules = await prisma.schedule.findMany({
    where: { userId: session.user.id },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
    },
  });

  const scheduleOverrides = await prisma.$queryRaw<ScheduleOverrideWindow[]>`
    SELECT "date", "startTime", "endTime", "notes"
    FROM "ScheduleOverride"
    WHERE "userId" = ${session.user.id}
      AND "date" >= ${todayStart}
      AND "date" <= ${todayEnd}
    ORDER BY "date" ASC
  `;

  const assignedHolidays = await prisma.$queryRaw<AssignedHoliday[]>`
    SELECT "id", "name", "date", "notes"
    FROM "HolidayAssignment"
    WHERE "userId" = ${session.user.id}
      AND "date" >= ${todayStart}
      AND "date" <= ${todayEnd}
    ORDER BY "date" ASC
  `;

  const todayWorkedHours = todayLogs.reduce((sum, log) => {
    return sum + getDurationInHours(log.clockIn, log.clockOut, log.breaks);
  }, 0);

  const todayDuration = formatDurationParts(todayWorkedHours);
  const todayHoliday = assignedHolidays[0];
  const todayOverride = scheduleOverrides[0];
  const todayWeeklySchedule = schedules.find((schedule) => schedule.dayOfWeek === now.getDay());
  const todaySchedule = todayOverride || todayWeeklySchedule || null;
  const todayScheduleHours = getScheduleHoursLabel(todaySchedule);
  const recentActivity = recentLogs
    .flatMap((log) => {
      const events: AttendanceActivity[] = [
        {
          id: `${log.id}-clock-in`,
          type: "CLOCK_IN",
          happenedAt: log.clockIn,
          label: "Clocked in",
          detail: getStatusLabel(log.status),
          duration: null as string | null,
        },
      ];

      if (log.clockOut) {
        events.push({
          id: `${log.id}-clock-out`,
          type: "CLOCK_OUT",
          happenedAt: log.clockOut,
          label: "Clocked out",
          detail: getClockOutDetail(
            { clockIn: log.clockIn, clockOut: log.clockOut, breaks: log.breaks },
            recentLogs,
            schedules
          ),
          duration: getDurationLabel(log.clockIn, log.clockOut, log.breaks),
        });
      }

      return events;
    })
    .sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime())
    .slice(0, 6);

  return (
    <div className="w-full space-y-4">
      <section className="rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Welcome
            </p>
            <h1 className="max-w-3xl text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {firstName}, here&apos;s your workday snapshot.
            </h1>
            <p className="text-xs text-muted-foreground">
              {roleLabel} | {format(now, "MMMM d, yyyy | h:mm a")}
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,0.8fr)]">
          <ClockWidget />

          <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/70 p-4">
            <div>
              <div>
                <p className="text-sm font-semibold text-foreground">Logged hours today</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Total time recorded today
                </p>
              </div>
            </div>

            <div className="mt-4 flex min-h-36 flex-col justify-center rounded-lg bg-card px-4 py-5 text-center ring-1 ring-border/70">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Total hours
              </p>
              <div className="mt-2 flex items-end justify-center gap-1 text-foreground">
                <span className="text-3xl font-semibold tracking-tight">
                  {todayDuration.hours}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  hrs
                </span>
                <span className="text-xl font-semibold tracking-tight">
                  {todayDuration.minutes}
                </span>
                <span className="pb-1 text-sm font-medium text-muted-foreground">
                  mins
                </span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Includes completed entries recorded today.
            </p>
          </div>

          <div className="flex h-full flex-col">
            <Link
              href="/schedule"
              className="flex min-h-[138px] flex-1 flex-col rounded-[18px] border border-brand-red bg-rose-50/80 px-4 py-4 text-left transition-colors hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-brand-red">{format(now, "EEEE")}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Today
                  </p>
                </div>
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-red text-white">
                  <CalendarDays className="size-4" />
                </span>
              </div>

              <div className="flex flex-1 flex-col justify-center pt-5 text-center">
                <p className="text-base font-semibold text-slate-950 dark:text-foreground">
                  {todayHoliday
                    ? todayHoliday.name
                    : todaySchedule
                      ? `${formatScheduleTime(todaySchedule.startTime)} - ${formatScheduleTime(todaySchedule.endTime)}`
                      : "Off today"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {todayHoliday ? "Assigned holiday" : todayScheduleHours || "No scheduled hours"}
                </p>
                {todayOverride?.notes && (
                  <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{todayOverride.notes}</p>
                )}
              </div>
            </Link>
          </div>
        </div>
        {todayHoliday && (
          <div className="border-t border-border/70 px-3 py-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                {todayHoliday.name} is assigned for today.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You do not need to clock in or out for this assigned holiday.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Recent Activity
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Your latest attendance events
            </h2>
          </div>
          <Link
            href="/timesheets"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            View timesheets
          </Link>
        </div>

        {recentActivity.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border/80 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
            No recent attendance activity to display.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background/70">
            <div className="hidden grid-cols-[1.15fr_1fr_1fr_90px] gap-3 border-b border-border/70 bg-muted/35 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground md:grid">
              <span>Activity</span>
              <span>Date</span>
              <span>Time</span>
              <span className="text-right">Duration</span>
            </div>
            {recentActivity.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 md:grid-cols-[1.15fr_1fr_1fr_90px] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Activity
                  </p>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${getActivityClass(event.type)}`}
                    >
                      {event.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{event.detail}</span>
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Date
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {format(event.happenedAt, "EEEE, MMM d")}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Time
                  </p>
                  <p className="text-xs text-muted-foreground md:text-sm md:text-foreground">
                    {format(event.happenedAt, "h:mm a")}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 md:justify-end">
                  <p className="md:hidden text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Duration
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {event.duration || "-"}
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
