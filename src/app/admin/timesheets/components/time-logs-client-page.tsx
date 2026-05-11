"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import {
    AlertCircle,
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronsUpDown,
    Clock3,
    Filter,
    Search,
    ShieldCheck,
    Timer,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TimeLogData = {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    status: string;
    projectName: string | null;
    user: {
        name: string;
        email: string;
        role: string;
    };
};

const RANGE_PRESETS = [7, 14, 30, 60, 90];

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
    return status === "ON_TIME" ? "On Time" : "Late";
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
        <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${status === "ON_TIME"
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
            : "border-rose-500/20 bg-rose-500/10 text-rose-500"
            }`}>
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

export function TimeLogsClientPage({ initialLogs }: { initialLogs: TimeLogData[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [roleFilter, setRoleFilter] = useState("ALL");
    const [dateFilter, setDateFilter] = useState("");
    const [rangeFilter, setRangeFilter] = useState("30");
    const [customRange, setCustomRange] = useState("30");
    const isCustomRange = rangeFilter === "CUSTOM";

    const rangeDays = Math.min(90, Math.max(1, Number.parseInt(isCustomRange ? customRange : rangeFilter, 10) || 30));
    const filteredLogs = initialLogs.filter(log => {
        // 1. Search Query Filter
        const matchesSearch = 
            log.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            log.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.projectName || "").toLowerCase().includes(searchQuery.toLowerCase());
        
        // 2. Status Filter
        const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;

        // 3. Role Filter
        const matchesRole = roleFilter === "ALL" || log.user.role === roleFilter;

        // 4. Date Filter
        let matchesDate = true;
        if (dateFilter) {
            const selectedDate = parseISO(dateFilter);
            matchesDate = isSameDay(new Date(log.clockIn), selectedDate);
        }

        // 5. Range Filter
        const matchesRange = dateFilter
            ? true
            : differenceInCalendarDays(startOfDay(new Date()), startOfDay(new Date(log.clockIn))) < rangeDays;

        return matchesSearch && matchesStatus && matchesRole && matchesDate && matchesRange;
    });

    const roleOptions = useMemo(() => {
        return Array.from(new Set(initialLogs.map((log) => log.user.role))).sort();
    }, [initialLogs]);

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

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setRoleFilter("ALL");
        setDateFilter("");
        setRangeFilter("30");
        setCustomRange("30");
    };

    const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || roleFilter !== "ALL" || dateFilter !== "" || rangeFilter !== "30" || (isCustomRange && customRange !== "30");

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                                <Clock3 className="size-3.5" />
                            </span>
                            <h1 className="text-sm font-semibold text-foreground">Company time logs</h1>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Showing {filteredLogs.length} matching logs
                            {dateFilter ? ` on ${format(parseISO(dateFilter), "MMM d, yyyy")}` : ` from the last ${rangeDays} days`}
                        </p>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="shrink-0 self-start lg:self-auto"
                        >
                            <X className="size-4" />
                            Clear filters
                        </Button>
                    )}
                </div>

                <div className="border-b px-4 py-3">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="relative w-full xl:max-w-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="size-4 text-muted-foreground" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search name, email, or project..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:items-center">
                    <div className="relative w-full sm:min-w-44">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter className="size-4 text-muted-foreground" />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-background border border-input text-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 appearance-none"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="ON_TIME">On Time</option>
                            <option value="LATE">Late</option>
                        </select>
                        <ChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
                    </div>

                    <div className="relative w-full sm:min-w-44">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <ShieldCheck className="size-4 text-muted-foreground" />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
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

                    <div className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm sm:min-w-52">
                        <span className="shrink-0 text-muted-foreground">Last</span>
                        <select
                            value={rangeFilter}
                            onChange={(event) => {
                                setRangeFilter(event.target.value);
                                if (event.target.value !== "CUSTOM") {
                                    setCustomRange(event.target.value);
                                }
                                setDateFilter("");
                            }}
                            className="h-7 cursor-pointer appearance-none bg-background text-foreground outline-none"
                            aria-label="Choose a common time log range"
                        >
                            {RANGE_PRESETS.map((days) => (
                                <option key={days} value={days}>
                                    {days} days
                                </option>
                            ))}
                            <option value="CUSTOM">Custom</option>
                        </select>
                        {isCustomRange && (
                            <>
                                <span className="relative inline-flex items-center">
                                    <input
                                        type="number"
                                        min={1}
                                        max={90}
                                        value={customRange}
                                        onChange={(event) => setCustomRange(event.target.value)}
                                        className="h-7 w-14 rounded-md border border-input bg-background pl-2 pr-5 text-center text-xs font-semibold text-foreground outline-none [appearance:textfield] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                        aria-label="Custom number of days"
                                    />
                                    <ChevronsUpDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
                                </span>
                                <span className="text-muted-foreground">days</span>
                            </>
                        )}
                        <ChevronDown className="size-4 text-muted-foreground" />
                    </div>

                    <div className="relative w-full sm:min-w-44">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CalendarIcon className="size-4 text-muted-foreground" />
                        </div>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full bg-background border border-input text-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                    </div>
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
                                <th className="px-4 py-3 font-semibold">Project</th>
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
                                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center">
                                            <CalendarIcon className="size-8 text-muted-foreground" />
                                            <p className="mt-3 font-semibold text-foreground">
                                                {hasActiveFilters ? "No matching logs" : "No time logs found"}
                                            </p>
                                            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                                                {hasActiveFilters
                                                    ? "Try widening the date range or clearing one of the filters."
                                                    : "Company time logs will appear here once employees clock in."}
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
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {log.projectName ? (
                                                    <span className="font-medium text-foreground">{log.projectName}</span>
                                                ) : (
                                                    "-"
                                                )}
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
                                    : "Company time logs will appear here once employees clock in."}
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
                                    <span>{log.projectName || "No project"}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
