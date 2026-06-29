import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_DAY_INDEXES = [1, 2, 3, 4, 5, 6, 0];
const UNPAID_BREAK_HOURS = 1;

type UserSchedulePageProps = {
  searchParams?: Promise<{
    week?: string;
    view?: string;
  }>;
};

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ScheduleOverrideRow = {
  id: string;
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

function parseTime(time?: string) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours + minutes / 60;
}

function formatTime(time?: string) {
  const parsed = parseTime(time);
  if (parsed === null) return "";

  const hours = Math.floor(parsed);
  const minutes = Math.round((parsed - hours) * 60);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""} ${period}`;
}

function getScheduleHours(schedule?: { startTime: string; endTime: string }) {
  const start = parseTime(schedule?.startTime);
  let end = parseTime(schedule?.endTime);

  if (start === null || end === null) return 0;
  if (end <= start) end += 24;
  return Math.max(0, end - start - UNPAID_BREAK_HOURS);
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parseWeekParam(value?: string) {
  if (!value) return new Date();
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date();
}

function getScheduleHref(date: Date, viewMode: "week" | "month") {
  return `/schedule?view=${viewMode}&week=${format(date, "yyyy-MM-dd")}`;
}

function getScheduleForDate(date: Date, schedules: ScheduleRow[], overrides: ScheduleOverrideRow[]) {
  const override = overrides.find((item) => isSameDay(item.date, date));
  if (override) return { startTime: override.startTime, endTime: override.endTime, notes: override.notes, isOverride: true };

  const schedule = schedules.find((item) => item.dayOfWeek === date.getDay());
  return schedule ? { startTime: schedule.startTime, endTime: schedule.endTime, notes: null, isOverride: false } : null;
}

export default async function UserSchedulePage({ searchParams }: UserSchedulePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const params = await searchParams;
  const now = new Date();
  const viewMode = params?.view === "month" ? "month" : "week";
  const selectedDate = parseWeekParam(params?.week);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const monthStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 });
  const monthEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 });
  const rangeStart = viewMode === "month" ? monthStart : weekStart;
  const rangeEnd = viewMode === "month" ? monthEnd : weekEnd;
  const previousPeriod = viewMode === "month" ? addMonths(selectedDate, -1) : addWeeks(weekStart, -1);
  const nextPeriod = viewMode === "month" ? addMonths(selectedDate, 1) : addWeeks(weekStart, 1);
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const currentPeriod = viewMode === "month" ? startOfMonth(now) : currentWeekStart;
  const todayIndex = now.getDay();
  await ensureScheduleOverrideTable();

  const [schedules, scheduleOverrides, assignedHolidays] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    }),
    prisma.$queryRaw<ScheduleOverrideRow[]>`
      SELECT "id", "date", "startTime", "endTime", "notes"
      FROM "ScheduleOverride"
      WHERE "userId" = ${session.user.id}
        AND "date" >= ${rangeStart}
        AND "date" <= ${rangeEnd}
      ORDER BY "date" ASC
    `,
    prisma.$queryRaw<AssignedHoliday[]>`
      SELECT "id", "name", "date", "notes"
      FROM "HolidayAssignment"
      WHERE "userId" = ${session.user.id}
        AND "date" >= ${rangeStart}
        AND "date" <= ${rangeEnd}
      ORDER BY "date" ASC
    `,
  ]);

  const todaySchedule = getScheduleForDate(now, schedules, scheduleOverrides);
  const visibleDates = viewMode === "month"
    ? eachDayOfInterval({ start: monthStart, end: monthEnd })
    : WEEK_DAY_INDEXES.map((_, offset) => addDays(weekStart, offset));
  const totalVisibleHours = visibleDates.reduce((total, date) => {
    const schedule = getScheduleForDate(date, schedules, scheduleOverrides);
    return total + getScheduleHours(schedule ?? undefined);
  }, 0);
  const scheduledVisibleDays = visibleDates.filter((date) => getScheduleForDate(date, schedules, scheduleOverrides)).length;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-steel">
            My Schedule
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
            Standard Hours
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {format(now, "EEEE, MMMM d, yyyy | h:mm a")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-red/25 bg-brand-red/10 px-3.5 py-1.5 text-sm font-semibold text-brand-red">
            <CalendarDays className="size-4" />
            Today is {DAYS[todayIndex]}
          </span>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
            <Clock3 className="size-4" />
            PH Timezone (GMT +8)
          </span>
          <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-sm font-medium text-muted-foreground">
            <Clock3 className="size-4" />
            {todaySchedule ? `${formatTime(todaySchedule.startTime)} - ${formatTime(todaySchedule.endTime)}` : "Off today"}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/70 bg-background/70 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {viewMode === "month" ? "Month view" : "Week range"}
              </p>
              <p className="mt-0.5 text-base font-semibold tracking-tight text-foreground">
                {viewMode === "month"
                  ? format(selectedDate, "MMMM yyyy")
                  : `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-md border border-border/70 bg-card px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {viewMode === "month" ? "Visible hours" : "Weekly hours"}
                </p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {formatHours(totalVisibleHours)} hrs
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-card px-2.5 py-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Scheduled days
                </p>
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {scheduledVisibleDays} of {visibleDates.length}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex rounded-lg border border-border/70 bg-card p-0.5 text-xs shadow-sm">
              <Link
                href={getScheduleHref(selectedDate, "week")}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 font-semibold transition-colors",
                  viewMode === "week"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                Week
              </Link>
              <Link
                href={getScheduleHref(selectedDate, "month")}
                className={cn(
                  "inline-flex h-8 items-center rounded-md px-3 font-semibold transition-colors",
                  viewMode === "month"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                Month
              </Link>
            </div>
            <Link
              href={getScheduleHref(previousPeriod, viewMode)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Link>
            <Link
              href={getScheduleHref(currentPeriod, viewMode)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {viewMode === "month" ? "Current month" : "Current week"}
            </Link>
            <Link
              href={getScheduleHref(nextPeriod, viewMode)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Next
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="border-b border-border/70 bg-background/70 px-4 py-2">
          <div className="hidden grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:grid">
            {WEEK_DAY_INDEXES.map((dayIndex) => (
              <span key={DAYS[dayIndex]}>{DAYS[dayIndex]}</span>
            ))}
          </div>
        </div>

        <div className={cn("grid gap-2 p-4 sm:grid-cols-2", viewMode === "month" ? "lg:grid-cols-7" : "lg:grid-cols-4")}>
          {visibleDates.map((date) => {
            const dayName = DAYS[date.getDay()];
            const schedule = getScheduleForDate(date, schedules, scheduleOverrides);
            const assignedHoliday = assignedHolidays.find((holiday) => isSameDay(holiday.date, date));
            const isToday = isSameDay(date, now);
            const isOutsideSelectedMonth = viewMode === "month" && !isSameMonth(date, selectedDate);

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "relative min-h-[104px] rounded-lg border p-3",
                  isToday
                    ? "border-brand-red bg-brand-red/10 shadow-sm shadow-brand-red/10"
                    : "border-border/70 bg-background",
                  isOutsideSelectedMonth && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={cn("text-sm font-semibold", isToday ? "text-brand-red" : "text-foreground")}>
                      {dayName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isToday ? "Today" : format(date, "MMM d")}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      isToday ? "bg-brand-red text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="size-3.5" />
                  </div>
                </div>

                <div className="mt-3">
                  {assignedHoliday ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {assignedHoliday.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned holiday - no clock-in needed
                      </p>
                    </>
                  ) : schedule ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatHours(getScheduleHours(schedule))} hours{schedule.isOverride ? " - special shift" : ""}
                      </p>
                      {schedule.isOverride && schedule.notes ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{schedule.notes}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm font-medium text-muted-foreground">Off</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
