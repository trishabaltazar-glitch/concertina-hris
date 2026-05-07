import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
    addDays,
    differenceInCalendarDays,
    endOfDay,
    format,
    isSameDay,
    isToday,
    isValid,
    parseISO,
    startOfDay,
} from "date-fns";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimesheetFilterBar } from "@/app/timesheets/components/timesheet-filter-bar";
import { DeleteTimeLogButton } from "@/app/timesheets/components/delete-time-log-button";

export const dynamic = "force-dynamic";

type TimesheetsPageProps = {
    searchParams?: Promise<{
        range?: string;
        from?: string;
        to?: string;
    }>;
};

type BreakWindow = {
    startedAt: Date;
    endedAt: Date | null;
};

type TimeLogWithBreaks = Prisma.TimeLogGetPayload<{
    include: {
        breaks: {
            select: {
                startedAt: true;
                endedAt: true;
            };
        };
    };
}>;

type TimelineSegment = {
    id: string;
    type: "work" | "break" | "overtime";
    startMinute: number;
    endMinute: number;
};

const WORKDAY_START_MINUTE = 9 * 60;
const WORKDAY_END_MINUTE = 18 * 60;

function parseDateFilter(value?: string, boundary: "start" | "end" = "start") {
    if (!value) return null;
    const parsed = parseISO(value);
    if (!isValid(parsed)) return null;
    return boundary === "start" ? startOfDay(parsed) : endOfDay(parsed);
}

function minutesFromMidnight(date: Date) {
    return date.getHours() * 60 + date.getMinutes();
}

function formatDuration(totalMinutes: number) {
    const safeMinutes = Math.max(0, totalMinutes);
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function formatHourLabel(minute: number) {
    const hour = Math.floor(minute / 60);
    return format(new Date(2025, 0, 1, hour, 0, 0), "HH:mm");
}

function getBreakMinutes(breaks: BreakWindow[], fallbackEnd: Date | null) {
    return breaks.reduce((sum, item) => {
        const end = item.endedAt || fallbackEnd;
        if (!end) return sum;
        return sum + Math.max(0, Math.round((end.getTime() - item.startedAt.getTime()) / 60000));
    }, 0);
}

function getWorkedMinutes(clockIn: Date, clockOut: Date | null, breaks: BreakWindow[]) {
    if (!clockOut) return 0;
    const grossMinutes = Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000));
    return Math.max(0, grossMinutes - getBreakMinutes(breaks, clockOut));
}

function splitWorkSegment(id: string, startMinute: number, endMinute: number) {
    if (endMinute <= startMinute) return [];
    if (startMinute >= WORKDAY_END_MINUTE) {
        return [{ id, type: "overtime" as const, startMinute, endMinute }];
    }
    if (endMinute <= WORKDAY_END_MINUTE) {
        return [{ id, type: "work" as const, startMinute, endMinute }];
    }

    return [
        { id: `${id}-work`, type: "work" as const, startMinute, endMinute: WORKDAY_END_MINUTE },
        { id: `${id}-overtime`, type: "overtime" as const, startMinute: WORKDAY_END_MINUTE, endMinute },
    ];
}

function buildSegments(logs: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    breaks: BreakWindow[];
}[]) {
    const segments: TimelineSegment[] = [];

    logs.forEach((log) => {
        const end = log.clockOut || new Date();
        let cursor = log.clockIn;

        log.breaks.forEach((item, index) => {
            const breakEnd = item.endedAt || end;
            segments.push(
                ...splitWorkSegment(
                    `${log.id}-work-${index}`,
                    minutesFromMidnight(cursor),
                    minutesFromMidnight(item.startedAt)
                )
            );
            segments.push({
                id: `${log.id}-break-${index}`,
                type: "break",
                startMinute: minutesFromMidnight(item.startedAt),
                endMinute: minutesFromMidnight(breakEnd),
            });
            cursor = breakEnd;
        });

        segments.push(
            ...splitWorkSegment(
                `${log.id}-work-final`,
                minutesFromMidnight(cursor),
                minutesFromMidnight(end)
            )
        );
    });

    return segments.filter((segment) => segment.endMinute > segment.startMinute);
}

function buildDays(fromDate: Date, toDate: Date) {
    const count = Math.max(0, differenceInCalendarDays(toDate, fromDate));
    return Array.from({ length: count + 1 }, (_, index) => addDays(fromDate, count - index));
}

export default async function TimesheetsPage({ searchParams }: TimesheetsPageProps) {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        redirect("/login");
    }

    const filters = await searchParams;
    const requestedRange = Number.parseInt(filters?.range || "7", 10) || 7;
    const rangeDays = Math.min(90, Math.max(1, requestedRange));
    const selectedRange = String(rangeDays);
    const today = new Date();
    const customFrom = parseDateFilter(filters?.from, "start");
    const customTo = parseDateFilter(filters?.to, "end");
    const toDate = customTo || endOfDay(today);
    const fromDate = customFrom || startOfDay(addDays(toDate, -(rangeDays - 1)));
    const fromValue = format(fromDate, "yyyy-MM-dd");
    const toValue = format(toDate, "yyyy-MM-dd");
    const displayRange = `${format(fromDate, "MMM dd")} - ${format(toDate, "MMM dd yyyy")}`;

    let timeLogs: TimeLogWithBreaks[] = [];
    let databaseError: string | null = null;

    try {
        timeLogs = await prisma.timeLog.findMany({
            where: {
                userId: session.user.id,
                clockIn: {
                    gte: fromDate,
                    lte: toDate,
                },
            },
            orderBy: { clockIn: "asc" },
            include: {
                breaks: {
                    orderBy: { startedAt: "asc" },
                    select: {
                        startedAt: true,
                        endedAt: true,
                    },
                },
            },
        });
    } catch (error) {
        console.error("Failed to load timesheet logs:", error);
        databaseError = "Timesheet data could not be loaded right now. Please refresh or try again in a moment.";
    }

    const days = buildDays(startOfDay(fromDate), startOfDay(toDate));
    const latestMinute = timeLogs.reduce((latest, log) => {
        const logEnd = log.clockOut || new Date();
        const breakEnd = log.breaks.reduce((max, item) => {
            const end = item.endedAt || logEnd;
            return Math.max(max, minutesFromMidnight(end));
        }, 0);
        return Math.max(latest, minutesFromMidnight(logEnd), breakEnd);
    }, WORKDAY_END_MINUTE);
    const timelineEndMinute = Math.max(WORKDAY_END_MINUTE, Math.ceil(latestMinute / 60) * 60);
    const timelineStartMinute = WORKDAY_START_MINUTE;
    const timelineTotalMinutes = Math.max(60, timelineEndMinute - timelineStartMinute);
    const timelineLabels = Array.from(
        { length: Math.floor(timelineTotalMinutes / 120) + 1 },
        (_, index) => timelineStartMinute + index * 120
    ).filter((minute) => minute <= timelineEndMinute);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <TimesheetFilterBar
                selectedRange={selectedRange}
                fromValue={fromValue}
                toValue={toValue}
                displayRange={displayRange}
            />

            <section className="rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full border text-xs">✓</span>
                        <h1 className="text-sm font-semibold text-foreground">My timesheets</h1>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <a href="/">
                            <Plus className="size-4" />
                            Entry log
                        </a>
                    </Button>
                </div>

                <div className="border-b px-4 py-3">
                    <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" />Working time</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" />Break</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Overtime</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />Late</span>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <div className="min-w-[780px] divide-y">
                        {databaseError ? (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                                {databaseError}
                            </div>
                        ) : days.length === 0 || timeLogs.length === 0 ? (
                            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                                No time logs found for this date range.
                            </div>
                        ) : (
                            days.map((day) => {
                                const logsForDay = timeLogs.filter((log) => isSameDay(log.clockIn, day));
                                if (logsForDay.length === 0) return null;

                                const firstClockIn = logsForDay[0]?.clockIn;
                                const lastClockOut = logsForDay.reduce<Date | null>((latest, log) => {
                                    if (!log.clockOut) return latest;
                                    if (!latest || log.clockOut > latest) return log.clockOut;
                                    return latest;
                                }, null);
                                const totalMinutes = logsForDay.reduce(
                                    (sum, log) => sum + getWorkedMinutes(log.clockIn, log.clockOut, log.breaks),
                                    0
                                );
                                const segments = buildSegments(logsForDay);
                                const isLate = logsForDay.some((log) => log.status === "LATE");
                                const noteText = logsForDay
                                    .flatMap((log) => [log.projectName, log.notes])
                                    .filter(Boolean)
                                    .join(" | ");

                                return (
                                    <div key={day.toISOString()} className="px-4 py-5">
                                        <div className="mb-3 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {isToday(day) ? "Today" : format(day, "EEEE, d")}
                                                </p>
                                                {noteText && (
                                                    <p className="mt-1 max-w-xl truncate text-xs text-muted-foreground">
                                                        {noteText}
                                                    </p>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Duration: <span className="font-semibold text-foreground">{formatDuration(totalMinutes)}</span>
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-[72px_1fr_72px] gap-3">
                                            <div className="text-xs text-muted-foreground">
                                                <p>Clock-in</p>
                                                <p className="mt-1 font-semibold text-foreground">
                                                    {firstClockIn ? format(firstClockIn, "h:mm a") : "-"}
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="relative h-4 text-[10px] text-muted-foreground">
                                                    {timelineLabels.map((minute) => (
                                                        <span
                                                            key={minute}
                                                            className="absolute -translate-x-1/2"
                                                            style={{
                                                                left: `${((minute - timelineStartMinute) / timelineTotalMinutes) * 100}%`,
                                                            }}
                                                        >
                                                            {formatHourLabel(minute)}
                                                        </span>
                                                    ))}
                                                </div>

                                                <div className="relative h-3 rounded-full bg-muted">
                                                    {segments.map((segment) => (
                                                        <span
                                                            key={segment.id}
                                                            className={
                                                                segment.type === "break"
                                                                    ? "absolute top-0 h-3 rounded-sm bg-sky-400"
                                                                    : segment.type === "overtime"
                                                                      ? "absolute top-0 h-3 rounded-sm bg-amber-400"
                                                                      : "absolute top-0 h-3 rounded-sm bg-violet-500"
                                                            }
                                                            style={{
                                                                left: `${Math.max(0, ((segment.startMinute - timelineStartMinute) / timelineTotalMinutes) * 100)}%`,
                                                                width: `${Math.max(1, ((segment.endMinute - segment.startMinute) / timelineTotalMinutes) * 100)}%`,
                                                            }}
                                                        />
                                                    ))}
                                                    {isLate && firstClockIn && (
                                                        <span
                                                            className="absolute -top-1 h-5 w-1 rounded-full bg-rose-500"
                                                            style={{
                                                                left: `${Math.max(0, ((minutesFromMidnight(firstClockIn) - timelineStartMinute) / timelineTotalMinutes) * 100)}%`,
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right text-xs text-muted-foreground">
                                                <p>Clock-out</p>
                                                <p className="mt-1 font-semibold text-foreground">
                                                    {lastClockOut ? format(lastClockOut, "h:mm a") : "Active"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-2">
                                            {logsForDay.map((log) => {
                                                const entryLabel = `${format(log.clockIn, "MMM d, h:mm a")} - ${log.clockOut ? format(log.clockOut, "h:mm a") : "Active"}`;
                                                const workedMinutes = getWorkedMinutes(log.clockIn, log.clockOut, log.breaks);

                                                return (
                                                    <div
                                                        key={log.id}
                                                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-foreground">
                                                                <span>{entryLabel}</span>
                                                                <span className="text-muted-foreground">
                                                                    {log.clockOut ? formatDuration(workedMinutes) : "Active"}
                                                                </span>
                                                            </div>
                                                            {(log.projectName || log.notes) && (
                                                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                                                    {[log.projectName, log.notes].filter(Boolean).join(" | ")}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <DeleteTimeLogButton timeLogId={log.id} label={entryLabel} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
