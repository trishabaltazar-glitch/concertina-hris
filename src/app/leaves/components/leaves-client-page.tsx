"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Hourglass, Paperclip, Trash2, XCircle } from "lucide-react";

import { cancelPendingLeaveRequest, submitLeaveRequest, updatePendingLeaveRequest } from "@/app/actions/leaves";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

type LeaveBalanceItem = {
  id: string;
  leaveType: string;
  balance: number;
};

type LeaveRequestItem = {
  id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  dayType: string;
  requestedDays: number;
  dayBreakdown: LeaveDaySelection[] | null;
  attachmentName: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
};

type LeavesClientPageProps = {
  balances: LeaveBalanceItem[];
  leaveRequests: LeaveRequestItem[];
};

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type LeaveDaySelection = {
  date: string;
  dayType: LeaveDayType;
  days: number;
};

type LeaveDayType = "FULL_DAY" | "HALF_DAY";

function getRequestDays(startDate: string | Date, endDate: string | Date, requestedDays?: number) {
  if (typeof requestedDays === "number") return requestedDays;

  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;

  if (!isValid(start) || !isValid(end)) {
    return 0;
  }

  return Math.max(0, differenceInCalendarDays(end, start) + 1);
}

function getLeaveLabel(leaveType: string) {
  if (leaveType === "LEAVE_CREDITS") return "PFFD Credits";

  return leaveType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getRequestDateLabel(request: LeaveRequestItem) {
  if (request.dayBreakdown?.length) {
    if (request.dayBreakdown.length === 1) {
      const item = request.dayBreakdown[0];
      return `${format(parseISO(item.date), "MMM d, yyyy")} (${item.dayType === "HALF_DAY" ? "half-day" : "full day"})`;
    }

    return `${format(parseISO(request.dayBreakdown[0].date), "MMM d")} - ${format(parseISO(request.dayBreakdown[request.dayBreakdown.length - 1].date), "MMM d, yyyy")}`;
  }

  if (request.dayType === "HALF_DAY") {
    return `${format(parseISO(request.startDate), "MMM d, yyyy")} (half-day)`;
  }

  return `${format(parseISO(request.startDate), "MMM d")} - ${format(parseISO(request.endDate), "MMM d, yyyy")}`;
}

function getBreakdownLabel(dayBreakdown: LeaveDaySelection[] | null) {
  if (!dayBreakdown?.length) return null;

  return dayBreakdown
    .map((item) => `${format(parseISO(item.date), "MMM d")} ${item.dayType === "HALF_DAY" ? "half" : "full"}`)
    .join(", ");
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-600/15"
      : status === "REJECTED"
        ? "bg-destructive/10 text-destructive ring-destructive/15"
        : "bg-amber-100 text-amber-800 ring-amber-600/15";

  const Icon = status === "APPROVED" ? CheckCircle2 : status === "REJECTED" ? XCircle : Clock3;

  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1", styles)}>
      <Icon className="size-3" />
      {status}
    </span>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

export function LeavesClientPage({ balances, leaveRequests }: LeavesClientPageProps) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [dayTypesByDate, setDayTypesByDate] = useState<Record<string, LeaveDayType>>({});
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const editingRequest = useMemo(
    () => leaveRequests.find((request) => request.id === editingRequestId && request.status === "PENDING") || null,
    [editingRequestId, leaveRequests]
  );

  async function handleSubmit(formData: FormData) {
    setFormError(null);

    const result = editingRequestId
      ? await updatePendingLeaveRequest(editingRequestId, formData)
      : await submitLeaveRequest(formData);

    if (!result.success) {
      setFormError(result.error || "Unable to save this request.");
      return;
    }

    setEditingRequestId(null);
    setDayTypesByDate({});
    setVisibleMonth(startOfMonth(new Date()));
  }

  function startEditingRequest(request: LeaveRequestItem) {
    setEditingRequestId(request.id);
    if (request.dayBreakdown?.length) {
      setDayTypesByDate(Object.fromEntries(request.dayBreakdown.map((item) => [item.date, item.dayType])));
    } else {
      const type = request.dayType === "HALF_DAY" ? "HALF_DAY" : "FULL_DAY";
      const dates = eachDayOfInterval({ start: parseISO(request.startDate), end: parseISO(request.endDate) });
      setDayTypesByDate(Object.fromEntries(dates.map((date) => [format(date, "yyyy-MM-dd"), type])));
    }
    setVisibleMonth(startOfMonth(parseISO(request.startDate)));
    setFormError(null);
  }

  function clearEditingRequest() {
    setEditingRequestId(null);
    setDayTypesByDate({});
    setVisibleMonth(startOfMonth(new Date()));
    setFormError(null);
  }

  function toggleCalendarDate(date: Date) {
    const dateKey = format(date, "yyyy-MM-dd");
    setDayTypesByDate((current) => ({
      ...current,
      [dateKey]: current[dateKey] ? (current[dateKey] === "FULL_DAY" ? "HALF_DAY" : "FULL_DAY") : "FULL_DAY",
    }));
  }

  const selectedBreakdown = useMemo(
    () =>
      Object.entries(dayTypesByDate)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .flatMap(([date, type]) => {
          if (!isValid(parseISO(date))) return [];
          return [{
            date,
            dayType: type,
            days: type === "HALF_DAY" ? 0.5 : 1,
          }];
        }),
    [dayTypesByDate],
  );
  const requestedDays = selectedBreakdown.reduce((sum, item) => sum + item.days, 0);
  const requestStartDate = selectedBreakdown[0]?.date || "";
  const requestEndDate = selectedBreakdown[selectedBreakdown.length - 1]?.date || "";
  const calendarDates = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(visibleMonth)),
        end: endOfWeek(endOfMonth(visibleMonth)),
      }),
    [visibleMonth],
  );

  const pendingCredits = useMemo(() => {
    return leaveRequests.reduce(
      (totals, request) => {
        const days = getRequestDays(request.startDate, request.endDate, request.requestedDays);

        if (request.status === "PENDING") {
          totals.set(request.leaveType, (totals.get(request.leaveType) ?? 0) + days);
        }

        return totals;
      },
      new Map<string, number>(),
    );
  }, [leaveRequests]);
  const totalPendingCredits = Array.from(pendingCredits.values()).reduce((sum, days) => sum + days, 0);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "ALL") {
      return leaveRequests;
    }

    return leaveRequests.filter((request) => request.status === statusFilter);
  }, [leaveRequests, statusFilter]);

  return (
    <div className="w-full space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{editingRequest ? "Edit Request" : "New Request"}</h2>
              {editingRequest && (
                <Button type="button" variant="ghost" size="xs" onClick={clearEditingRequest}>
                  Cancel edit
                </Button>
              )}
            </div>
          </div>

          <form action={handleSubmit} className="space-y-3 p-4">
            <div>
              <FieldLabel htmlFor="leaveType">Type</FieldLabel>
              <input type="hidden" name="leaveType" value="LEAVE_CREDITS" id="leaveType" />
              <div className="flex h-9 w-full items-center rounded-lg border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                PFFD Credits
              </div>
            </div>

            <input type="hidden" name="startDate" value={requestStartDate} />
            <input type="hidden" name="endDate" value={requestEndDate} />

            <div className="rounded-lg border border-border p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth((month) => subMonths(month, 1))} aria-label="Previous month">
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="text-sm font-semibold text-foreground">{format(visibleMonth, "MMMM yyyy")}</p>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDates.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const selectedType = dayTypesByDate[dateKey];
                  const inMonth = isSameMonth(date, visibleMonth);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => toggleCalendarDate(date)}
                      className={cn(
                        "flex aspect-square min-h-9 flex-col items-center justify-center rounded-md border text-xs transition-colors",
                        selectedType
                          ? selectedType === "HALF_DAY"
                            ? "border-amber-300 bg-amber-50 text-amber-800"
                            : "border-primary/30 bg-primary/10 text-primary"
                          : "border-transparent bg-background text-foreground hover:border-border hover:bg-muted/50",
                        !inMonth && "text-muted-foreground/45",
                        isToday(date) && !selectedType && "border-primary/30",
                      )}
                      aria-label={`${format(date, "MMMM d, yyyy")}${selectedType ? ` ${selectedType === "HALF_DAY" ? "half day" : "full day"}` : ""}`}
                    >
                      <span className="font-medium">{format(date, "d")}</span>
                      {selectedType && (
                        <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none">
                          {selectedType === "HALF_DAY" ? "Half" : "Full"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1.5 text-primary">Selected full day</div>
                <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-800">Selected half day</div>
              </div>
            </div>

            {selectedBreakdown.map((item) => (
              <span key={item.date} className="hidden">
                <input type="hidden" name="leaveDate" value={item.date} />
                <input type="hidden" name="leaveDateType" value={item.dayType} />
              </span>
            ))}

            {selectedBreakdown.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selected days</p>
                </div>
                <div className="max-h-64 divide-y divide-border overflow-y-auto">
                  {selectedBreakdown.map((item) => {
                    return (
                      <div key={item.date} className="grid grid-cols-[1fr_116px_auto] items-center gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{format(parseISO(item.date), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(item.date), "EEEE")}</p>
                        </div>
                        <select
                          value={item.dayType}
                          onChange={(event) => {
                            setDayTypesByDate((current) => ({
                              ...current,
                              [item.date]: event.target.value as LeaveDayType,
                            }));
                          }}
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="FULL_DAY">Full day</option>
                          <option value="HALF_DAY">Half day</option>
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setDayTypesByDate((current) => {
                              const next = { ...current };
                              delete next[item.date];
                              return next;
                            });
                          }}
                          aria-label={`Remove ${format(parseISO(item.date), "MMM d, yyyy")}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {selectedBreakdown.length > 0
                      ? `${selectedBreakdown.length} selected date${selectedBreakdown.length === 1 ? "" : "s"}`
                      : "Add dates to preview this request."}
                  </p>
                  {selectedBreakdown.length > 0 && (
                    <p className={cn("mt-0.5 text-sm font-semibold", requestedDays > 0 ? "text-primary" : "text-destructive")}>
                      {requestedDays > 0 ? `${requestedDays} PFFD day${requestedDays === 1 ? "" : "s"}` : "Select at least one date"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="attachment">Attachment Required</FieldLabel>
              <input
                type="file"
                name="attachment"
                id="attachment"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                required={!editingRequest?.attachmentName}
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                PDF or image, up to 5MB. {editingRequest?.attachmentName ? "A new upload is optional because this request already has an attachment." : "Required for every new request."}
              </p>
            </div>

            <div>
              <FieldLabel htmlFor="reason">Reason Required</FieldLabel>
              <textarea
                name="reason"
                id="reason"
                key={editingRequest?.id || "new-reason"}
                defaultValue={editingRequest?.reason || ""}
                rows={3}
                required
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            {formError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <SubmitButton size="sm" disabled={selectedBreakdown.length === 0}>{editingRequest ? "Save Changes" : "Submit Request"}</SubmitButton>
          </form>
        </section>

        <div className="grid content-start gap-3 md:grid-cols-2">
          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CalendarDays className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-foreground">Your Balances</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Available credits are the current balances you can request from each credit type before pending requests are approved.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {balances.length ? (
                balances.map((balance) => (
                  <div key={balance.id} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground">{getLeaveLabel(balance.leaveType)}</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-primary">
                      {balance.balance}
                      <span className="ml-1 text-xs font-medium text-muted-foreground">credit{balance.balance === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                  No available credits assigned yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <Hourglass className="size-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">Pending credits</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Pending credits are requested days waiting for approval and are not final until reviewed.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {pendingCredits.size ? (
                Array.from(pendingCredits.entries()).map(([leaveType, days]) => (
                  <div key={leaveType} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">{getLeaveLabel(leaveType)}</span>
                    <span className="text-sm font-semibold text-amber-700">{days} day{days === 1 ? "" : "s"}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
                  No pending credit requests.
                </div>
              )}
              <div className="border-t border-border pt-2 text-xs text-muted-foreground">
                Total pending: <span className="font-semibold text-foreground">{totalPendingCredits}</span> day{totalPendingCredits === 1 ? "" : "s"}
              </div>
            </div>
          </section>
        </div>
      </div>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Request History</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"} shown</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant={statusFilter === status ? "secondary" : "outline"}
                    size="xs"
                    onClick={() => setStatusFilter(status)}
                    className="shadow-none"
                  >
                    {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">{statusFilter === "ALL" ? "No PFFD requests yet" : `No ${statusFilter.toLowerCase()} requests`}</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                {statusFilter === "ALL"
                  ? "Submitted PFFD requests will appear here with their dates and approval status."
                  : "Try another status filter to view more of your request history."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Duration</th>
                      <th className="px-4 py-3 font-semibold">Days</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Filed</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium capitalize">{getLeaveLabel(request.leaveType)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          <div>{getRequestDateLabel(request)}</div>
                          {getBreakdownLabel(request.dayBreakdown) && (
                            <div className="mt-0.5 max-w-xs truncate text-xs" title={getBreakdownLabel(request.dayBreakdown) || undefined}>
                              {getBreakdownLabel(request.dayBreakdown)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{request.requestedDays}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div>{format(parseISO(request.createdAt), "MMM d, yyyy")}</div>
                          {request.attachmentName && (
                            <a href={`/leaves/attachments/${request.id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-steel hover:text-brand-red">
                              <Paperclip className="size-3" />
                              Attachment
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {request.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" size="xs" onClick={() => startEditingRequest(request)}>
                                Edit
                              </Button>
                              <form
                                action={async () => {
                                  await cancelPendingLeaveRequest(request.id);
                                }}
                              >
                                <SubmitButton variant="destructive-outline" size="xs" className="h-7 text-xs">
                                  Cancel
                                </SubmitButton>
                              </form>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 p-3 md:hidden">
                {filteredRequests.map((request) => (
                  <article key={request.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold capitalize">{getLeaveLabel(request.leaveType)}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {getRequestDateLabel(request)}
                        </p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    {getBreakdownLabel(request.dayBreakdown) && (
                      <p className="mt-2 text-xs text-muted-foreground">{getBreakdownLabel(request.dayBreakdown)}</p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Days</p>
                        <p className="font-semibold">{request.requestedDays}</p>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Filed</p>
                        <p className="font-semibold">{format(parseISO(request.createdAt), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    {request.attachmentName && (
                      <a href={`/leaves/attachments/${request.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-steel hover:text-brand-red">
                        <Paperclip className="size-3" />
                        View attachment
                      </a>
                    )}
                    {request.status === "PENDING" && (
                      <div className="mt-3 flex gap-2">
                        <Button type="button" variant="outline" size="xs" onClick={() => startEditingRequest(request)}>
                          Edit
                        </Button>
                        <form
                          action={async () => {
                            await cancelPendingLeaveRequest(request.id);
                          }}
                        >
                          <SubmitButton variant="destructive-outline" size="xs" className="h-7 text-xs">
                            Cancel
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
    </div>
  );
}
