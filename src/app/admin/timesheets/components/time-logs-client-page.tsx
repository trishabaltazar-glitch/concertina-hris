"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfDay,
    startOfMonth,
    startOfWeek,
} from "date-fns";
import {
    AlertCircle,
    Calendar as CalendarIcon,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    Search,
    ShieldCheck,
    Timer,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    ManualEntryApprovalsPopup,
    type ManualEntryApprovalsPopupProps,
} from "./manual-entry-approvals-popup";

type TimeLogData = {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    status: string;
    user: {
        name: string;
        email: string;
        role: string;
    };
};

function getDurationMinutes(log: TimeLogData) {
    if (!log.clockOut) return 0;
    return Math.max(0, Math.round((new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime()) / 60000));
}

function formatDuration(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
}

function getLogDuration(log: TimeLogData) {
    return log.clockOut ? formatDuration(getDurationMinutes(log)) : "Active";
}

function getStatusLabel(status: string) {
    if (status === "ON_TIME") return "On Time";
    if (status === "LATE") return "Late";
    if (status === "FORCED_CHECKOUT") return "Auto clock-out";
    return status.replaceAll("_", " ");
}

function getStatusPillClassName(status: string) {
    if (status === "ON_TIME") {
        return "border-emerald-500/20 bg-emerald-500/10 text-emerald-500";
    }

    if (status === "FORCED_CHECKOUT") {
        return "border-amber-500/20 bg-amber-500/10 text-amber-600";
    }

    return "border-rose-500/20 bg-rose-500/10 text-rose-500";
}

function formatRole(role: string) {
    return role
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function StatusPill({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${getStatusPillClassName(status)}`}>
            {getStatusLabel(status)}
        </span>
    );
}

function RolePill({ role }: { role: string }) {
    return (
        <span className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
            {formatRole(role)}
        </span>
    );
}

function getCalendarDays(month: Date) {
    return eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
    });
}

type TimeLogsClientPageProps = {
    initialLogs: TimeLogData[];
    availableRoles: string[];
    scopeLabel: string;
    pagination: {
        page: number;
        pageSize: number;
        totalLogs: number;
    };
    initialFilters: {
        search: string;
        status: string;
        role: string;
        from: Date;
        to: Date;
    };
    manualEntryApprovals: ManualEntryApprovalsPopupProps;
};

export function TimeLogsClientPage({
    initialLogs,
    availableRoles,
    scopeLabel,
    pagination,
    initialFilters,
    manualEntryApprovals,
}: TimeLogsClientPageProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const defaultToDate = startOfDay(new Date());
    const defaultFromDate = startOfDay(addDays(defaultToDate, -29));
    const [searchQuery, setSearchQuery] = useState(initialFilters.search);
    const [statusFilter, setStatusFilter] = useState(initialFilters.status);
    const [roleFilter, setRoleFilter] = useState(initialFilters.role);
    const [selectedFrom, setSelectedFrom] = useState(startOfDay(new Date(initialFilters.from)));
    const [selectedTo, setSelectedTo] = useState(startOfDay(new Date(initialFilters.to)));
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(startOfMonth(new Date(initialFilters.from)));
    const [draftFrom, setDraftFrom] = useState<Date | null>(startOfDay(new Date(initialFilters.from)));
    const [draftTo, setDraftTo] = useState<Date | null>(startOfDay(new Date(initialFilters.to)));
    const filteredLogs = initialLogs;

    const roleOptions = useMemo(() => {
        return Array.from(new Set(availableRoles)).sort();
    }, [availableRoles]);

    const summary = useMemo(() => {
        const activeLogs = filteredLogs.filter((log) => !log.clockOut).length;
        const lateLogs = filteredLogs.filter((log) => log.status === "LATE").length;
        const totalMinutes = filteredLogs.reduce((sum, log) => sum + getDurationMinutes(log), 0);
        const employees = new Set(filteredLogs.map((log) => log.user.email)).size;

        return {
            activeLogs,
            lateLogs,
            totalMinutes,
            employees,
        };
    }, [filteredLogs]);

    const navigateWithFilters = ({
        search = searchQuery,
        status = statusFilter,
        role = roleFilter,
        from = selectedFrom,
        to = selectedTo,
        page = 1,
    }: {
        search?: string;
        status?: string;
        role?: string;
        from?: Date;
        to?: Date;
        page?: number;
    } = {}) => {
        const params = new URLSearchParams();
        const trimmedSearch = search.trim();
        const safeFrom = startOfDay(from);
        const safeTo = startOfDay(to);

        if (trimmedSearch) params.set("search", trimmedSearch);
        if (status !== "ALL") params.set("status", status);
        if (role !== "ALL") params.set("role", role);
        if (format(safeFrom, "yyyy-MM-dd") !== format(defaultFromDate, "yyyy-MM-dd")) {
            params.set("from", format(safeFrom, "yyyy-MM-dd"));
        }
        if (format(safeTo, "yyyy-MM-dd") !== format(defaultToDate, "yyyy-MM-dd")) {
            params.set("to", format(safeTo, "yyyy-MM-dd"));
        }
        if (page > 1) params.set("page", String(page));

        startTransition(() => {
            router.replace(params.size ? `/admin/timesheets?${params.toString()}` : "/admin/timesheets");
        });
    };

    const clearFilters = () => {
        startTransition(() => {
            router.replace("/admin/timesheets");
        });
    };

    const isDefaultDateRange =
        format(selectedFrom, "yyyy-MM-dd") === format(defaultFromDate, "yyyy-MM-dd") &&
        format(selectedTo, "yyyy-MM-dd") === format(defaultToDate, "yyyy-MM-dd");
    const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || roleFilter !== "ALL" || !isDefaultDateRange;
    const calendarDays = getCalendarDays(viewMonth);
    const canApplyRange = Boolean(draftFrom && draftTo);
    const totalPages = Math.max(1, Math.ceil(pagination.totalLogs / pagination.pageSize));
    const pageStart = pagination.totalLogs === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
    const pageEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalLogs);

    const openCalendar = () => {
        setDraftFrom(selectedFrom);
        setDraftTo(selectedTo);
        setViewMonth(startOfMonth(selectedFrom));
        setIsCalendarOpen((value) => !value);
    };

    const handleDateSelect = (day: Date) => {
        if (!draftFrom || draftTo || isBefore(day, draftFrom)) {
            setDraftFrom(day);
            setDraftTo(null);
            return;
        }

        setDraftTo(day);
    };

    const handleApplyRange = () => {
        if (!draftFrom || !draftTo) return;

        const [safeFrom, safeTo] = isBefore(draftTo, draftFrom) ? [draftTo, draftFrom] : [draftFrom, draftTo];
        const nextFrom = startOfDay(safeFrom);
        const nextTo = startOfDay(safeTo);
        setSelectedFrom(nextFrom);
        setSelectedTo(nextTo);
        setIsCalendarOpen(false);
        navigateWithFilters({ from: nextFrom, to: nextTo, page: 1 });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                            <Clock3 className="size-3.5" />
                        </span>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">{scopeLabel}</h1>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Showing {pageStart}-{pageEnd} of {pagination.totalLogs} matching logs from {format(selectedFrom, "MMM d, yyyy")} to {format(selectedTo, "MMM d, yyyy")}
                        {isPending ? " - updating" : ""}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
                    <ManualEntryApprovalsPopup {...manualEntryApprovals} />
                    {hasActiveFilters && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="shrink-0"
                        >
                            <X className="size-4" />
                            Clear filters
                        </Button>
                    )}
                </div>
            </div>

            <section className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)_minmax(19rem,1.2fr)]">
                    <div className="relative w-full min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="size-4 text-muted-foreground" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => {
                                if (searchQuery !== initialFilters.search) {
                                    navigateWithFilters({ search: searchQuery, page: 1 });
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    navigateWithFilters({ search: searchQuery, page: 1 });
                                }
                            }}
                            className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                    </div>

                    <div className="relative w-full min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="size-4 text-muted-foreground" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                navigateWithFilters({ status: e.target.value, page: 1 });
                            }}
                            className="w-full bg-background border border-input text-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ON_TIME">On Time</option>
                            <option value="LATE">Late</option>
                            <option value="FORCED_CHECKOUT">Auto clock-out</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
                    </div>

                    <div className="relative w-full min-w-0">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <ShieldCheck className="size-4 text-muted-foreground" />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => {
                                setRoleFilter(e.target.value);
                                navigateWithFilters({ role: e.target.value, page: 1 });
                            }}
                            className="w-full bg-background border border-input text-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none"
                        >
                            <option value="ALL">All Roles</option>
                            {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                    {formatRole(role)}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
                    </div>

                    <div className="relative w-full min-w-0 md:col-span-2 xl:col-span-1">
                        <div className="flex max-w-full flex-wrap items-center gap-0 rounded-lg border border-input bg-background text-sm shadow-sm">
                            <button
                                type="button"
                                onClick={openCalendar}
                                className="group flex h-10 shrink-0 items-center gap-2 border-r border-border bg-muted/45 px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                aria-expanded={isCalendarOpen}
                                aria-label="Open calendar date range picker"
                            >
                                <CalendarDays className="size-3.5 text-brand-red" />
                                <span className="whitespace-nowrap">Date range</span>
                                <span className="hidden rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border sm:inline-flex">
                                    Open calendar
                                </span>
                                <ChevronDown
                                    className={cn(
                                        "size-3.5 text-muted-foreground transition-transform group-hover:text-foreground",
                                        isCalendarOpen && "rotate-180"
                                    )}
                                />
                            </button>

                            <button
                                type="button"
                                onClick={openCalendar}
                                className="flex h-10 min-w-0 flex-1 items-center gap-2 overflow-hidden px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                            >
                                <span className="truncate text-muted-foreground">
                                    {format(selectedFrom, "MMM d, yyyy")}
                                </span>
                                <span className="shrink-0 text-muted-foreground">to</span>
                                <span className="truncate text-muted-foreground">
                                    {format(selectedTo, "MMM d, yyyy")}
                                </span>
                            </button>
                        </div>

                        {isCalendarOpen && (
                            <div className="absolute left-0 top-12 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setViewMonth((month) => addMonths(month, -1))}
                                        className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        aria-label="Previous month"
                                    >
                                        <ChevronLeft className="size-4" />
                                    </button>
                                    <p className="text-sm font-semibold text-foreground">
                                        {format(viewMonth, "MMMM yyyy")}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setViewMonth((month) => addMonths(month, 1))}
                                        className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                        aria-label="Next month"
                                    >
                                        <ChevronRight className="size-4" />
                                    </button>
                                </div>

                                <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                        <span key={day} className="py-1">
                                            {day}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-1 grid grid-cols-7 gap-1">
                                    {calendarDays.map((day) => {
                                        const isRangeStart = draftFrom ? isSameDay(day, draftFrom) : false;
                                        const isRangeEnd = draftTo ? isSameDay(day, draftTo) : false;
                                        const isInsideRange =
                                            draftFrom && draftTo && isAfter(day, draftFrom) && isBefore(day, draftTo);

                                        return (
                                            <button
                                                key={day.toISOString()}
                                                type="button"
                                                onClick={() => handleDateSelect(day)}
                                                className={cn(
                                                    "h-9 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                                                    !isSameMonth(day, viewMonth) && "text-muted-foreground/45",
                                                    isInsideRange && "bg-muted text-foreground",
                                                    (isRangeStart || isRangeEnd) && "bg-foreground text-background hover:bg-foreground/90",
                                                    !isRangeStart && !isRangeEnd && !isInsideRange && "hover:bg-muted"
                                                )}
                                                aria-pressed={isRangeStart || isRangeEnd}
                                            >
                                                {format(day, "d")}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                                    <p className="min-w-0 text-xs text-muted-foreground">
                                        {draftFrom && draftTo
                                            ? `${format(draftFrom, "MMM d")} - ${format(draftTo, "MMM d, yyyy")}`
                                            : "Select a start and end date"}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleApplyRange}
                                        disabled={!canApplyRange}
                                        className="inline-flex h-8 items-center justify-center rounded-md bg-foreground px-3 text-xs font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                <div className="grid gap-2 border-b px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                <Clock3 className="size-3.5" />
                                Total completed
                            </div>
                            <p className="mt-1 text-sm font-semibold text-foreground">{formatDuration(summary.totalMinutes)}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                <Timer className="size-3.5" />
                                Active logs
                            </div>
                            <p className="mt-1 text-sm font-semibold text-foreground">{summary.activeLogs}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                <AlertCircle className="size-3.5" />
                                Late logs
                            </div>
                            <p className="mt-1 text-sm font-semibold text-foreground">{summary.lateLogs}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
                            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                <Search className="size-3.5" />
                                Employees
                            </div>
                            <p className="mt-1 text-sm font-semibold text-foreground">{summary.employees}</p>
                        </div>
                </div>

                <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full text-sm text-left">
                        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Employee</th>
                                <th className="px-4 py-3 font-semibold">Role</th>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Clock in</th>
                                <th className="px-4 py-3 font-semibold">Clock out</th>
                                <th className="px-4 py-3 font-semibold">Duration</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center">
                                            <CalendarIcon className="size-8 text-muted-foreground" />
                                            <p className="mt-3 font-semibold text-foreground">
                                                {hasActiveFilters ? "No matching logs" : "No time logs found"}
                                            </p>
                                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                                {hasActiveFilters
                                                    ? "Try widening the date range or clearing one of the filters."
                                                    : `${scopeLabel} will appear here once employees clock in.`}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    return (
                                        <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-foreground">{log.user.name}</div>
                                                <div className="text-xs text-muted-foreground">{log.user.email}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <RolePill role={log.user.role} />
                                            </td>
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                {format(new Date(log.clockIn), "MMM d, yyyy")}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {format(new Date(log.clockIn), "h:mm a")}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {log.clockOut ? format(new Date(log.clockOut), "h:mm a") : <span className="font-semibold text-primary">Active</span>}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                {getLogDuration(log)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <StatusPill status={log.status} />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="divide-y lg:hidden">
                    {filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center px-4 py-12 text-center">
                            <CalendarIcon className="size-8 text-muted-foreground" />
                            <p className="mt-3 font-semibold text-foreground">
                                {hasActiveFilters ? "No matching logs" : "No time logs found"}
                            </p>
                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                {hasActiveFilters
                                    ? "Try widening the date range or clearing one of the filters."
                                    : `${scopeLabel} will appear here once employees clock in.`}
                            </p>
                        </div>
                    ) : (
                        filteredLogs.map((log) => (
                            <div key={log.id} className="px-4 py-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">{log.user.name}</p>
                                        <p className="truncate text-xs text-muted-foreground">{log.user.email}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                        <StatusPill status={log.status} />
                                        <RolePill role={log.user.role} />
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs">
                                    <div>
                                        <p className="text-muted-foreground">In</p>
                                        <p className="mt-1 font-semibold text-foreground">{format(new Date(log.clockIn), "h:mm a")}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Out</p>
                                        <p className="mt-1 font-semibold text-foreground">
                                            {log.clockOut ? format(new Date(log.clockOut), "h:mm a") : "Active"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground">Total</p>
                                        <p className="mt-1 font-semibold text-foreground">{getLogDuration(log)}</p>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span className="font-medium text-foreground">{format(new Date(log.clockIn), "MMM d, yyyy")}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        Page {pagination.page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pagination.page <= 1 || isPending}
                            onClick={() => navigateWithFilters({ page: pagination.page - 1 })}
                        >
                            <ChevronLeft className="size-4" />
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pagination.page >= totalPages || isPending}
                            onClick={() => navigateWithFilters({ page: pagination.page + 1 })}
                        >
                            Next
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
