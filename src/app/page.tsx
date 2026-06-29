import { ClockWidget } from "@/components/dashboard/clock-widget";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { endOfDay, format, startOfDay } from "date-fns";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";
import { CalendarDays, Timer } from "lucide-react";
import { getAnnouncementContentHtml } from "@/lib/announcement-content";
import { LaunchpadAnnouncements } from "./launchpad-announcements";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type ScheduleWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type AttendanceActivity = {
  id: string;
  type: "CLOCK_IN" | "CLOCK_OUT";
  happenedAt: Date;
  label: string;
  detail: string;
  duration: string | null;
};

type DashboardTimeLog = {
  id: string;
  clockIn: Date;
  clockOut: Date | null;
  status: string;
};

type AnnouncementPreview = {
  id: string;
  title: string;
  html: string;
  previewText: string;
  createdAtLabel: string;
};

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  authorName: string;
};

type LaunchpadSummaryRow = {
  todayWorkedHours: number | null;
  todayLogCount: number | bigint | null;
  weeklySchedule: ScheduleWindow | null;
  todayOverride: { startTime: string; endTime: string; notes: string | null } | null;
  todayHoliday: { name: string; notes: string | null } | null;
  activeClockIn: Date | null;
};

function getDurationInHours(clockIn: Date, clockOut: Date | null) {
  if (!clockOut) return 0;
  return Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
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

function getDurationLabel(clockIn: Date, clockOut: Date | null) {
  if (!clockOut) return "-";

  const diffInMinutes = Math.max(
    0,
    Math.round(getDurationInHours(clockIn, clockOut) * 60)
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
    ? "border-sky-500/25 bg-sky-500/12 text-sky-700 ring-sky-500/15 dark:text-sky-300"
    : "border-rose-500/25 bg-rose-500/12 text-rose-700 ring-rose-500/15 dark:text-rose-300";
}

function getClockOutDetail(
  log: { clockIn: Date; clockOut: Date },
  logs: { clockIn: Date; clockOut: Date | null }[],
  schedules: ScheduleWindow[]
) {
  const shiftWindow = getShiftWindowForLog(log.clockIn, log.clockOut, schedules);
  const completedHoursForShift = logs.reduce((sum, item) => {
    if (!item.clockOut) return sum;
    if (item.clockIn >= shiftWindow.end || item.clockOut <= shiftWindow.start) return sum;
    if (item.clockOut > log.clockOut) return sum;
    return sum + getDurationInHours(item.clockIn, item.clockOut);
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

function getAnnouncementPreviewText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function LaunchpadAnnouncementsSkeleton() {
  return (
    <section className="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="mt-3 h-5 w-32 rounded-full bg-muted/80" />
        </div>
        <div className="h-9 w-16 rounded-md bg-muted" />
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 size-7 rounded-md bg-muted" />
              <div className="min-w-0 flex-1">
                <div className="h-3.5 w-2/3 rounded-full bg-muted" />
                <div className="mt-2 h-2.5 w-1/2 rounded-full bg-muted/80" />
                <div className="mt-3 h-3 w-full rounded-full bg-muted/70" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentActivitySkeleton() {
  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-3 w-28 rounded-full bg-muted" />
          <div className="mt-3 h-5 w-56 rounded-full bg-muted/80" />
        </div>
        <div className="h-9 w-32 rounded-md bg-muted" />
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-border/70 bg-background/70">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="grid gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 md:grid-cols-[1.15fr_1fr_1fr_90px] md:items-center md:gap-3"
          >
            <div className="h-4 rounded-full bg-muted" />
            <div className="h-4 rounded-full bg-muted/80" />
            <div className="h-4 rounded-full bg-muted/70" />
            <div className="h-4 rounded-full bg-muted/60" />
          </div>
        ))}
      </div>
    </section>
  );
}

async function LaunchpadAnnouncementsSection() {
  let announcements: AnnouncementPreview[] = [];
  let announcementsUnavailable = false;

  try {
    const announcementRows = await prisma.$queryRaw<AnnouncementRow[]>`
      SELECT
        a."id",
        a."title",
        a."content",
        a."createdAt",
        u."name" as "authorName"
      FROM "Announcement" a
      INNER JOIN "User" u ON u."id" = a."authorId"
      ORDER BY a."createdAt" DESC
      LIMIT 4
    `;

    announcements = announcementRows.map((announcement) => {
      const html = getAnnouncementContentHtml(announcement.content);

      return {
        id: announcement.id,
        title: announcement.title,
        html,
        previewText: getAnnouncementPreviewText(html) || "Open announcement",
        createdAtLabel: `${format(announcement.createdAt, "MMM d, yyyy h:mm a")} by ${announcement.authorName}`,
      };
    });
  } catch {
    announcements = [];
    announcementsUnavailable = true;
  }

  return (
    <LaunchpadAnnouncements
      className="flex-1"
      announcements={announcements}
      unavailable={announcementsUnavailable}
    />
  );
}

async function RecentActivitySection({ userId }: { userId: string }) {
  let recentLogs: DashboardTimeLog[] = [];
  let schedules: ScheduleWindow[] = [];

  try {
    [recentLogs, schedules] = await Promise.all([
      prisma.timeLog.findMany({
        where: { userId },
        orderBy: { clockIn: "desc" },
        take: 5,
        select: {
          id: true,
          clockIn: true,
          clockOut: true,
          status: true,
        },
      }),
      prisma.schedule.findMany({
        where: { userId },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
      }),
    ]);
  } catch {
    recentLogs = [];
    schedules = [];
  }

  const recentActivity = recentLogs
    .flatMap((log) => {
      const events: AttendanceActivity[] = [
        {
          id: `${log.id}-clock-in`,
          type: "CLOCK_IN",
          happenedAt: log.clockIn,
          label: "IN",
          detail: getStatusLabel(log.status),
          duration: null as string | null,
        },
      ];

      if (log.clockOut) {
        events.push({
          id: `${log.id}-clock-out`,
          type: "CLOCK_OUT",
          happenedAt: log.clockOut,
          label: "OUT",
          detail: getClockOutDetail(
            { clockIn: log.clockIn, clockOut: log.clockOut },
            recentLogs,
            schedules
          ),
          duration: getDurationLabel(log.clockIn, log.clockOut),
        });
      }

      return events;
    })
    .sort((a, b) => b.happenedAt.getTime() - a.happenedAt.getTime())
    .slice(0, 6);

  return (
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
        <Button asChild variant="outline" size="sm" className="h-9 w-fit shadow-sm">
          <Link href="/timesheets" prefetch={false}>
            <CalendarDays className="size-4" />
            View timesheets
          </Link>
        </Button>
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
                    className={`inline-flex min-w-10 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold leading-5 tracking-[0.06em] shadow-sm ring-1 ${getActivityClass(event.type)}`}
                  >
                    {event.label}
                  </span>
                  <span className="text-sm text-muted-foreground">{event.detail}</span>
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
  );
}

async function LaunchpadWorkspace({
  userId,
  now,
}: {
  userId: string;
  now: Date;
}) {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  await ensureScheduleOverrideTable();

  let todayWorkedHours = 0;
  let todayLogCount = 0;
  let todayWeeklySchedule: ScheduleWindow | null = null;
  let todayOverride: { startTime: string; endTime: string; notes: string | null } | null = null;
  let todayHoliday: { name: string; notes: string | null } | null = null;
  let activeClockIn: Date | null = null;

  try {
    const [summary] = await prisma.$queryRaw<LaunchpadSummaryRow[]>`
      SELECT
        COALESCE((
          SELECT SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600)
          FROM "TimeLog"
          WHERE "userId" = ${userId}
            AND "clockIn" >= ${todayStart}
            AND "clockIn" <= ${todayEnd}
            AND "clockOut" IS NOT NULL
        ), 0)::double precision AS "todayWorkedHours",
        (
          SELECT COUNT(*)::int
          FROM "TimeLog"
          WHERE "userId" = ${userId}
            AND "clockIn" >= ${todayStart}
            AND "clockIn" <= ${todayEnd}
        ) AS "todayLogCount",
        (
          SELECT jsonb_build_object(
            'dayOfWeek', "dayOfWeek",
            'startTime', "startTime",
            'endTime', "endTime"
          )
          FROM "Schedule"
          WHERE "userId" = ${userId}
            AND "dayOfWeek" = ${now.getDay()}
          LIMIT 1
        ) AS "weeklySchedule",
        (
          SELECT jsonb_build_object(
            'startTime', "startTime",
            'endTime', "endTime",
            'notes', "notes"
          )
          FROM "ScheduleOverride"
          WHERE "userId" = ${userId}
            AND "date" >= ${todayStart}
            AND "date" <= ${todayEnd}
          ORDER BY "date" ASC
          LIMIT 1
        ) AS "todayOverride",
        (
          SELECT jsonb_build_object(
            'name', "name",
            'notes', "notes"
          )
          FROM "HolidayAssignment"
          WHERE "userId" = ${userId}
            AND "date" >= ${todayStart}
            AND "date" <= ${todayEnd}
          ORDER BY "date" ASC
          LIMIT 1
        ) AS "todayHoliday",
        (
          SELECT "clockIn"
          FROM "TimeLog"
          WHERE "userId" = ${userId}
            AND "clockOut" IS NULL
            AND "clockIn" >= ${todayStart}
            AND "clockIn" <= ${todayEnd}
          ORDER BY "clockIn" DESC
          LIMIT 1
        ) AS "activeClockIn"
    `;

    todayWorkedHours = Number(summary?.todayWorkedHours || 0);
    todayLogCount = Number(summary?.todayLogCount || 0);
    todayWeeklySchedule = summary?.weeklySchedule || null;
    todayOverride = summary?.todayOverride || null;
    todayHoliday = summary?.todayHoliday || null;
    activeClockIn = summary?.activeClockIn || null;
  } catch {
    todayWorkedHours = 0;
    todayLogCount = 0;
    todayWeeklySchedule = null;
    todayOverride = null;
    todayHoliday = null;
    activeClockIn = null;
  }

  const todayDuration = formatDurationParts(todayWorkedHours);
  const todaySchedule = todayOverride || todayWeeklySchedule || null;
  const todayScheduleHours = getScheduleHoursLabel(todaySchedule);
  const initialClockStatus = {
    isClockedIn: !!activeClockIn,
    clockInTime: activeClockIn?.toISOString() || null,
  };

  return (
    <>
        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)]">
          <div className="space-y-4">
            <Link
              href="/schedule"
              prefetch={false}
              className="flex w-full items-start justify-between gap-4 rounded-lg border border-brand-red/70 bg-rose-50/80 px-4 py-3 text-left shadow-sm transition-colors hover:bg-rose-50 dark:bg-rose-950/20 dark:hover:bg-rose-950/30"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
                  Today&apos;s Schedule
                </p>
                <p className="mt-1 text-sm font-semibold text-brand-red">{format(now, "EEEE")}</p>
              </div>
              <div className="min-w-0 text-right">
                <div className="flex items-center justify-end gap-1.5 text-sm font-semibold text-slate-950 dark:text-foreground">
                  <CalendarDays className="size-3.5 shrink-0 text-brand-red" />
                  <span className="truncate">
                    {todayHoliday
                      ? todayHoliday.name
                      : todaySchedule
                        ? `${formatScheduleTime(todaySchedule.startTime)} - ${formatScheduleTime(todaySchedule.endTime)}`
                        : "Off today"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {todayHoliday ? "Assigned holiday" : todayScheduleHours || "No scheduled hours"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {todayOverride?.notes || "PH Timezone (GMT +8)"}
                </p>
              </div>
            </Link>

            <ClockWidget initialStatus={initialClockStatus} />

            <div className="flex flex-col rounded-lg border border-border/70 bg-card p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-brand-steel">
                  <Timer className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Logged hours today</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Completed entries recorded today
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Total hours
                    </p>
                    <div className="mt-1 flex items-end gap-1 text-foreground">
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
                  <div className="inline-flex h-8 w-fit items-center self-start rounded-md border border-border/70 bg-card px-3 text-sm text-muted-foreground sm:self-auto">
                    <span className="font-semibold text-foreground">{todayLogCount}</span>
                    <span className="ml-1.5">
                      {todayLogCount === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-2 rounded-md bg-muted/35 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Active clock-ins are added after clock-out.
              </p>
            </div>
          </div>

          <div className="flex min-h-0 self-stretch">
            <Suspense fallback={<LaunchpadAnnouncementsSkeleton />}>
              <LaunchpadAnnouncementsSection />
            </Suspense>
          </div>
        </div>

        {todayHoliday && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {todayHoliday.name} is assigned for today.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You do not need to clock in or out for this assigned holiday.
            </p>
          </div>
        )}

      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivitySection userId={userId} />
      </Suspense>
    </>
  );
}

function LaunchpadWorkspaceSkeleton() {
  return (
    <>
      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-brand-red/30 bg-rose-50/60 px-4 py-3 shadow-sm dark:bg-rose-950/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="h-3 w-32 rounded-full bg-muted" />
                <div className="mt-3 h-4 w-24 rounded-full bg-muted/80" />
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-right">
                <div className="ml-auto h-4 w-40 rounded-full bg-muted" />
                <div className="ml-auto h-3 w-28 rounded-full bg-muted/80" />
                <div className="ml-auto h-3 w-32 rounded-full bg-muted/70" />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-md bg-muted" />
                <div>
                  <div className="h-4 w-28 rounded-full bg-muted" />
                  <div className="mt-2 h-3 w-36 rounded-full bg-muted/80" />
                </div>
              </div>
              <div className="h-6 w-16 rounded-md bg-muted" />
            </div>
            <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3">
              <div className="mx-auto h-3 w-36 rounded-full bg-muted" />
              <div className="mx-auto mt-3 h-14 w-56 rounded-md bg-muted/80" />
              <div className="mx-auto mt-4 h-12 w-full rounded-md bg-muted" />
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-card p-3 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-md bg-muted" />
              <div>
                <div className="h-4 w-36 rounded-full bg-muted" />
                <div className="mt-2 h-3 w-44 rounded-full bg-muted/80" />
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border/70 bg-background/70 p-3">
              <div className="h-3 w-24 rounded-full bg-muted" />
              <div className="mt-3 h-9 w-44 rounded-md bg-muted/80" />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 self-stretch">
          <LaunchpadAnnouncementsSkeleton />
        </div>
      </div>

      <RecentActivitySkeleton />
    </>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  if (!userId) {
    redirect("/login");
  }

  const now = new Date();
  const firstName = session.user.name?.trim().split(/\s+/)[0] || "there";
  const roleLabel = formatRoleLabel((session.user as { role?: string | null }).role);

  return (
    <div className="w-full space-y-5">
      <section className="space-y-4">
        <div className="flex flex-col gap-1">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Launchpad
            </p>
            <h1 className="max-w-3xl text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {firstName}, here&apos;s your workday snapshot.
            </h1>
            <p className="text-xs text-muted-foreground">
              {roleLabel} | {format(now, "MMMM d, yyyy | h:mm a")}
            </p>
          </div>
        </div>

        <Suspense fallback={<LaunchpadWorkspaceSkeleton />}>
          <LaunchpadWorkspace userId={userId} now={now} />
        </Suspense>
      </section>
    </div>
  );
}
