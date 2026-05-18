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
import { AlertCircle, CalendarX2, CheckCircle2, Clock3, Coffee, Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TimesheetFilterBar } from "@/app/timesheets/components/timesheet-filter-bar";
import { DeleteTimeLogButton } from "@/app/timesheets/components/delete-time-log-button";
import {
    cancelPendingManualTimeEntryRequest,
    submitManualTimeEntryRequest,
    updatePendingManualTimeEntryRequest,
} from "@/app/actions/time";

export const dynamic = "force-dynamic";

type TimesheetsPageProps = {
    searchParams?: Promise<{
        range?: string;
        from?: string;
        to?: string;
        empty?: string;
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

type ManualTimeEntryRequest = {
    id: string;
    clockIn: Date;
    clockOut: Date;
    reason: string | null;
    status: string;
    createdAt: Date;
    reviewedAt: Date | null;
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

function formatMinuteLabel(minute: number) {
    const clampedMinute = Math.max(0, Math.min(23 * 60 + 59, minute));
    const hour = Math.floor(clampedMinute / 60);
    const minutes = clampedMinute % 60;
    return format(new Date(2025, 0, 1, hour, minutes, 0), "h:mm a");
}

function getSegmentLabel(segment: TimelineSegment) {
    const typeLabel = segment.type === "break" ? "Break" : segment.type === "overtime" ? "Overtime" : "Working time";
    return `${typeLabel}: ${formatMinuteLabel(segment.startMinute)} - ${formatMinuteLabel(segment.endMinute)}`;
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

function getOvertimeMinutes(clockIn: Date, clockOut: Date | null, breaks: BreakWindow[]) {
    const end = clockOut || new Date();
    return buildSegments([{ id: "summary", clockIn, clockOut: end, breaks }])
        .filter((segment) => segment.type === "overtime")
        .reduce((sum, segment) => sum + (segment.endMinute - segment.startMinute), 0);
}

function buildDays(fromDate: Date, toDate: Date) {
    const count = Math.max(0, differenceInCalendarDays(toDate, fromDate));
    return Array.from({ length: count + 1 }, (_, index) => addDays(fromDate, count - index));
}

function getRequestStatusClass(status: string) {
    if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
}

function RequestStatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getRequestStatusClass(status)}`}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    );
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
    const showEmptyDays = filters?.empty === "1";
    const toDate = customTo || endOfDay(today);
    const fromDate = customFrom || startOfDay(addDays(toDate, -(rangeDays - 1)));
    const fromValue = format(fromDate, "yyyy-MM-dd");
    const toValue = format(toDate, "yyyy-MM-dd");
    const displayRange = `${format(fromDate, "MMM dd")} - ${format(toDate, "MMM dd yyyy")}`;

    let timeLogs: TimeLogWithBreaks[] = [];
    let manualRequests: ManualTimeEntryRequest[] = [];
    let databaseError: string | null = null;

    try {
        [timeLogs, manualRequests] = await Promise.all([
            prisma.timeLog.findMany({
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
            }),
            prisma.$queryRaw<ManualTimeEntryRequest[]>`
                SELECT "id", "clockIn", "clockOut", "reason", "status", "createdAt", "reviewedAt"
                FROM "TimeEntryRequest"
                WHERE "userId" = ${session.user.id}
                ORDER BY "createdAt" DESC
                LIMIT 8
            `,
        ]);
    } catch (error) {
        console.error("Failed to load timesheet logs:", error);
        databaseError = "Timesheet data could not be loaded right now. Please refresh or try again in a moment.";
    }

    const days = buildDays(startOfDay(fromDate), startOfDay(toDate));
    const totalWorkedMinutes = timeLogs.reduce(
        (sum, log) => sum + getWorkedMinutes(log.clockIn, log.clockOut, log.breaks),
        0
    );
    const totalBreakMinutes = timeLogs.reduce(
        (sum, log) => sum + getBreakMinutes(log.breaks, log.clockOut || new Date()),
        0
    );
    const totalOvertimeMinutes = timeLogs.reduce(
        (sum, log) => sum + getOvertimeMinutes(log.clockIn, log.clockOut, log.breaks),
        0
    );
    const lateDays = new Set(
        timeLogs.filter((log) => log.status === "LATE").map((log) => format(log.clockIn, "yyyy-MM-dd"))
    ).size;
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
        <div className="w-full space-y-6">
            <TimesheetFilterBar
                selectedRange={selectedRange}
                fromValue={fromValue}
                toValue={toValue}
                displayRange={displayRange}
                showEmptyDays={showEmptyDays}
            />

            <section className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div className="rounded-2xl border bg-card shadow-sm">
                    <div className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                                <Plus className="size-3.5" />
                            </span>
                            <h2 className="text-sm font-semibold text-foreground">Manual entry request</h2>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Submit missed or corrected hours for manager approval.
                        </p>
                    </div>
                    <form
                        action={async (formData) => {
                            "use server";
                            await submitManualTimeEntryRequest(formData);
                        }}
                        className="space-y-3 px-4 py-4"
                    >
                        <div className="grid gap-3 sm:grid-cols-3">
                            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                Date
                                <input
                                    type="date"
                                    name="date"
                                    defaultValue={format(today, "yyyy-MM-dd")}
                                    required
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                            </label>
                            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                Clock in
                                <input
                                    type="time"
                                    name="clockIn"
                                    required
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                            </label>
                            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                Clock out
                                <input
                                    type="time"
                                    name="clockOut"
                                    required
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                />
                            </label>
                        </div>
                        <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
                            Reason
                            <textarea
                                name="reason"
                                required
                                rows={3}
                                maxLength={500}
                                placeholder="Example: Forgot to clock in after client call."
                                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            />
                        </label>
                        <div className="flex justify-end">
                            <SubmitButton size="sm">Submit for approval</SubmitButton>
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Manual entry requests</h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Your latest approval status.
                            </p>
                        </div>
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {manualRequests.length}
                        </span>
                    </div>
                    <div className="divide-y">
                        {manualRequests.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                                No manual entry requests yet.
                            </div>
                        ) : (
                            manualRequests.map((request) => (
                                <div key={request.id} className="px-4 py-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground">
                                                {format(request.clockIn, "MMM d, h:mm a")} - {format(request.clockOut, "h:mm a")}
                                            </p>
                                            <p className="mt-1 truncate text-xs text-muted-foreground" title={request.reason || undefined}>
                                                {request.reason || "No reason provided"}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                                            <RequestStatusBadge status={request.status} />
                                            <span className="text-xs text-muted-foreground">
                                                {format(request.createdAt, "MMM d")}
                                            </span>
                                        </div>
                                    </div>
                                    {request.status === "PENDING" && (
                                        <div className="mt-3 rounded-lg border border-border bg-background/60 p-3">
                                            <form
                                                action={async (formData) => {
                                                    "use server";
                                                    await updatePendingManualTimeEntryRequest(request.id, formData);
                                                }}
                                                className="grid gap-2 lg:grid-cols-[140px_110px_110px_minmax(0,1fr)_auto]"
                                            >
                                                <input
                                                    type="date"
                                                    name="date"
                                                    defaultValue={format(request.clockIn, "yyyy-MM-dd")}
                                                    required
                                                    className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                                    aria-label="Manual request date"
                                                />
                                                <input
                                                    type="time"
                                                    name="clockIn"
                                                    defaultValue={format(request.clockIn, "HH:mm")}
                                                    required
                                                    className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                                    aria-label="Manual request clock in"
                                                />
                                                <input
                                                    type="time"
                                                    name="clockOut"
                                                    defaultValue={format(request.clockOut, "HH:mm")}
                                                    required
                                                    className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                                    aria-label="Manual request clock out"
                                                />
                                                <input
                                                    type="text"
                                                    name="reason"
                                                    defaultValue={request.reason || ""}
                                                    required
                                                    maxLength={500}
                                                    className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                                    aria-label="Manual request reason"
                                                />
                                                <SubmitButton size="xs" className="h-9">
                                                    Save
                                                </SubmitButton>
                                            </form>
                                            <form
                                                action={async () => {
                                                    "use server";
                                                    await cancelPendingManualTimeEntryRequest(request.id);
                                                }}
                                                className="mt-2 flex justify-end"
                                            >
                                                <SubmitButton variant="destructive-outline" size="xs" className="h-8 text-xs">
                                                    Cancel request
                                                </SubmitButton>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                            <CheckCircle2 className="size-3.5" />
                        </span>
                        <h1 className="text-sm font-semibold text-foreground">My timesheets</h1>
                    </div>
                    <Button asChild variant="outline" size="sm">
                        <a href="/">
                            <Plus className="size-4" />
                            Entry log
                        </a>
                    </Button>
                </div>

                <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            Total worked
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatDuration(totalWorkedMinutes)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <Coffee className="size-3.5" />
                            Break time
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatDuration(totalBreakMinutes)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <Timer className="size-3.5" />
                            Overtime
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatDuration(totalOvertimeMinutes)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                            <AlertCircle className="size-3.5" />
                            Late days
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{lateDays}</p>
                    </div>
                </div>

                <div className="border-b px-4 py-3">
                    <div className="flex flex-wrap items-center justify-center gap-5 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" />Working time</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-400" />Break</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" />Overtime</span>
                        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" />Late</span>
                    </div>
                </div>

                <div className="divide-y">
                    {databaseError ? (
                        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                            {databaseError}
                        </div>
                    ) : days.length === 0 ? (
                        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Choose a valid date range to review your timesheets.
                        </div>
                    ) : timeLogs.length === 0 && !showEmptyDays ? (
                        <div className="flex flex-col items-center px-4 py-12 text-center">
                            <CalendarX2 className="size-8 text-muted-foreground" />
                            <h2 className="mt-3 text-sm font-semibold text-foreground">No entries in this range</h2>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                Try another date range or open the entry log if you need to add today&apos;s time.
                            </p>
                            <Button asChild variant="outline" size="sm" className="mt-4">
                                <a href="/">
                                    <Plus className="size-4" />
                                    Entry log
                                </a>
                            </Button>
                        </div>
                    ) : (
                        days.map((day) => {
                            const logsForDay = timeLogs.filter((log) => isSameDay(log.clockIn, day));
                            if (logsForDay.length === 0) {
                                if (!showEmptyDays) return null;

                                return (
                                    <div key={day.toISOString()} className="px-4 py-5">
                                        <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-background/50 px-3 py-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">
                                                    {isToday(day) ? "Today" : format(day, "EEEE, MMM d")}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">No time log recorded.</p>
                                            </div>
                                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">
                                                <CalendarX2 className="size-3.5" />
                                                No entry
                                            </span>
                                        </div>
                                    </div>
                                );
                            }

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
                                return (
                                    <div key={day.toISOString()} className="px-4 py-5">
                                        <div className="mb-3 flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">
                                                    {isToday(day) ? "Today" : format(day, "EEEE, d")}
                                                </p>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Duration: <span className="font-semibold text-foreground">{formatDuration(totalMinutes)}</span>
                                            </p>
                                        </div>

                                        <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs md:hidden">
                                            <div>
                                                <p className="text-muted-foreground">In</p>
                                                <p className="mt-1 font-semibold text-foreground">
                                                    {firstClockIn ? format(firstClockIn, "h:mm a") : "-"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Out</p>
                                                <p className="mt-1 font-semibold text-foreground">
                                                    {lastClockOut ? format(lastClockOut, "h:mm a") : "Active"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-muted-foreground">Total</p>
                                                <p className="mt-1 font-semibold text-foreground">{formatDuration(totalMinutes)}</p>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto pb-1">
                                        <div className="grid min-w-[720px] grid-cols-[72px_1fr_72px] gap-3">
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
                                                            title={getSegmentLabel(segment)}
                                                            aria-label={getSegmentLabel(segment)}
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
                                                            title={`Late: ${formatMinuteLabel(minutesFromMidnight(firstClockIn))}`}
                                                            aria-label={`Late: ${formatMinuteLabel(minutesFromMidnight(firstClockIn))}`}
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
            </section>
        </div>
    );
}
