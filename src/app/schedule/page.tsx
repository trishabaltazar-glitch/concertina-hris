import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { addDays, addWeeks, endOfWeek, format, isSameDay, isValid, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_DAY_INDEXES = [1, 2, 3, 4, 5, 6, 0];
const UNPAID_BREAK_HOURS = 1;

type UserSchedulePageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

type ScheduleRow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

function getScheduleHours(schedule?: ScheduleRow) {
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

function getWeekHref(date: Date) {
  return `/schedule?week=${format(date, "yyyy-MM-dd")}`;
}

export default async function UserSchedulePage({ searchParams }: UserSchedulePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const params = await searchParams;
  const now = new Date();
  const selectedDate = parseWeekParam(params?.week);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const previousWeek = addWeeks(weekStart, -1);
  const nextWeek = addWeeks(weekStart, 1);
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const todayIndex = now.getDay();

  const [schedules, assignedHolidays] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId: session.user.id },
      orderBy: { dayOfWeek: "asc" },
      select: {
        dayOfWeek: true,
        startTime: true,
        endTime: true,
      },
    }),
    prisma.$queryRaw<AssignedHoliday[]>`
      SELECT "id", "name", "date", "notes"
      FROM "HolidayAssignment"
      WHERE "userId" = ${session.user.id}
        AND "date" >= ${weekStart}
        AND "date" <= ${weekEnd}
      ORDER BY "date" ASC
    `,
  ]);

  const todaySchedule = schedules.find((schedule) => schedule.dayOfWeek === todayIndex);
  const totalWeeklyHours = schedules.reduce((total, schedule) => total + getScheduleHours(schedule), 0);

  return (
    <div className="w-full">
      <section className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel">
              My Schedule
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Standard Hours
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {format(now, "EEEE, MMMM d, yyyy | h:mm a")}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-red/25 bg-brand-red/10 px-3 py-1.5 text-sm font-medium text-brand-red">
              <CalendarDays className="size-4" />
              Today is {DAYS[todayIndex]}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground">
              <Clock3 className="size-4" />
              {todaySchedule ? `${formatTime(todaySchedule.startTime)} - ${formatTime(todaySchedule.endTime)}` : "Off today"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-border/70 bg-background/70 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Week range
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={getWeekHref(previousWeek)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ChevronLeft className="size-4" />
              Previous
            </Link>
            <Link
              href={getWeekHref(currentWeekStart)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border/70 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Current week
            </Link>
            <Link
              href={getWeekHref(nextWeek)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/70 bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Next
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 border-b border-border/70 bg-muted/20 px-5 py-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Weekly hours
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {formatHours(totalWeeklyHours)} hrs
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Scheduled days
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {schedules.length} of 7
            </p>
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {WEEK_DAY_INDEXES.map((dayIndex, offset) => {
            const date = addDays(weekStart, offset);
            const dayName = DAYS[dayIndex];
            const schedule = schedules.find((item) => item.dayOfWeek === dayIndex);
            const assignedHoliday = assignedHolidays.find((holiday) => isSameDay(holiday.date, date));
            const isToday = isSameDay(date, now);

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "relative min-h-[124px] rounded-2xl border p-4",
                  isToday
                    ? "border-brand-red bg-brand-red/10 shadow-sm shadow-brand-red/10"
                    : "border-border/70 bg-background"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={cn("text-base font-semibold", isToday ? "text-brand-red" : "text-foreground")}>
                      {dayName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isToday ? "Today" : format(date, "MMM d")}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      isToday ? "bg-brand-red text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="size-4" />
                  </div>
                </div>

                <div className="mt-5">
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
                        {formatHours(getScheduleHours(schedule))} hours
                      </p>
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
