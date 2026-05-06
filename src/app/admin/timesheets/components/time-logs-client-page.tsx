"use client";

import { useState } from "react";
import { format, isSameDay, parseISO } from "date-fns";
import { Search, Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TimeLogData = {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    status: string;
    user: {
        name: string;
        email: string;
    };
};

export function TimeLogsClientPage({ initialLogs }: { initialLogs: TimeLogData[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [dateFilter, setDateFilter] = useState("");

    const filteredLogs = initialLogs.filter(log => {
        // 1. Search Query Filter
        const matchesSearch = 
            log.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            log.user.email.toLowerCase().includes(searchQuery.toLowerCase());
        
        // 2. Status Filter
        const matchesStatus = statusFilter === "ALL" || log.status === statusFilter;

        // 3. Date Filter
        let matchesDate = true;
        if (dateFilter) {
            const selectedDate = parseISO(dateFilter);
            matchesDate = isSameDay(new Date(log.clockIn), selectedDate);
        }

        return matchesSearch && matchesStatus && matchesDate;
    });

    const clearFilters = () => {
        setSearchQuery("");
        setStatusFilter("ALL");
        setDateFilter("");
    };

    const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || dateFilter !== "";

    return (
        <div className="space-y-6">
            {/* Filter Control Panel */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
                    {/* Search Input */}
                    <div className="relative w-full md:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="size-4 text-muted-foreground" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                        />
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative w-full md:w-48">
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
                    </div>

                    {/* Date Picker */}
                    <div className="relative w-full md:w-48">
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

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={clearFilters}
                        className="shrink-0"
                    >
                        <X className="size-4" />
                        Clear Filters
                    </Button>
                )}
            </div>

            {/* Status Bar */}
            <div className="text-sm text-muted-foreground font-medium px-1">
                Showing {filteredLogs.length} matching logs
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/60 text-muted-foreground border-b border-border text-xs uppercase tracking-wider sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Employee</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold">Clock In</th>
                                <th className="px-6 py-4 font-semibold">Clock Out</th>
                                <th className="px-6 py-4 font-semibold">Duration</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        {hasActiveFilters 
                                            ? "No logs found matching your specific filters." 
                                            : "No active time logs found across the company."}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    let duration = "-";
                                    if (log.clockOut) {
                                        const diffMs = new Date(log.clockOut).getTime() - new Date(log.clockIn).getTime();
                                        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                                        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                                        duration = `${diffHrs}h ${diffMins}m`;
                                    }

                                    return (
                                        <tr key={log.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-foreground">{log.user.name}</div>
                                                <div className="text-xs text-muted-foreground">{log.user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {format(new Date(log.clockIn), "MMM d, yyyy")}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {format(new Date(log.clockIn), "h:mm a")}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {log.clockOut ? format(new Date(log.clockOut), "h:mm a") : <span className="text-primary italic animate-pulse font-semibold">Active</span>}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-foreground">
                                                {duration}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${log.status === 'ON_TIME'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                    : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                                                    }`}>
                                                    {log.status === 'ON_TIME' ? 'On Time' : 'Late'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
