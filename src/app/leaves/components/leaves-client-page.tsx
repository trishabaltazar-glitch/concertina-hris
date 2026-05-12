"use client";

import { useMemo, useState } from "react";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, FileText, Hourglass, Paperclip, XCircle } from "lucide-react";

import { submitLeaveRequest } from "@/app/actions/leaves";
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
  return leaveType === "LEAVE_CREDITS" ? "PFFD Credits" : leaveType.toLowerCase();
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayType, setDayType] = useState("FULL_DAY");

  async function handleSubmit(formData: FormData) {
    await submitLeaveRequest(formData);
  }

  const pffdBalance = balances.find((balance) => balance.leaveType === "LEAVE_CREDITS")?.balance ?? 0;
  const requestedDays = dayType === "HALF_DAY" ? 0.5 : getRequestDays(startDate, endDate);
  const hasDateRange = startDate !== "" && endDate !== "";

  const stats = useMemo(() => {
    return leaveRequests.reduce(
      (totals, request) => {
        const days = getRequestDays(request.startDate, request.endDate, request.requestedDays);

        if (request.status === "PENDING") {
          totals.pending += days;
        }

        if (request.status === "APPROVED") {
          totals.used += days;
        }

        return totals;
      },
      { pending: 0, used: 0 },
    );
  }, [leaveRequests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === "ALL") {
      return leaveRequests;
    }

    return leaveRequests.filter((request) => request.status === statusFilter);
  }, [leaveRequests, statusFilter]);

  const summaryItems = [
    {
      label: "Available",
      value: pffdBalance,
      helper: "credits",
      icon: CalendarDays,
      className: "text-primary",
      iconClassName: "bg-primary/10 text-primary",
    },
    {
      label: "Pending",
      value: stats.pending,
      helper: "days",
      icon: Hourglass,
      className: "text-amber-700",
      iconClassName: "bg-amber-100 text-amber-700",
    },
    {
      label: "Approved",
      value: stats.used,
      helper: "days",
      icon: CheckCircle2,
      className: "text-emerald-700",
      iconClassName: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {summaryItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="flex items-center gap-3 p-4">
                <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", item.iconClassName)}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className={cn("text-2xl font-bold leading-none", item.className)}>{item.value}</span>
                    <span className="text-xs text-muted-foreground">{item.helper}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">New Request</h2>
          </div>

          <form action={handleSubmit} className="space-y-3 p-4">
            <div>
              <FieldLabel htmlFor="leaveType">Type</FieldLabel>
              <input type="hidden" name="leaveType" value="LEAVE_CREDITS" id="leaveType" />
              <div className="flex h-9 w-full items-center rounded-lg border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                PFFD Credits
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <FieldLabel htmlFor="dayType">Duration</FieldLabel>
                <select
                  name="dayType"
                  id="dayType"
                  value={dayType}
                  onChange={(event) => {
                    setDayType(event.target.value);
                    if (event.target.value === "HALF_DAY" && startDate) {
                      setEndDate(startDate);
                    }
                  }}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="FULL_DAY">Full day</option>
                  <option value="HALF_DAY">Half day</option>
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="startDate">Start</FieldLabel>
                <input
                  type="date"
                  name="startDate"
                  id="startDate"
                  required
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    if (dayType === "HALF_DAY") {
                      setEndDate(event.target.value);
                    }
                  }}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
              <div>
                <FieldLabel htmlFor="endDate">End</FieldLabel>
                <input
                  type="date"
                  name="endDate"
                  id="endDate"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={dayType === "HALF_DAY"}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/35 p-3">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {hasDateRange && requestedDays > 0
                      ? dayType === "HALF_DAY"
                        ? `${format(parseISO(startDate), "MMM d, yyyy")} (half-day)`
                        : `${format(parseISO(startDate), "MMM d")} to ${format(parseISO(endDate), "MMM d, yyyy")}`
                      : "Choose dates to preview this request."}
                  </p>
                  {hasDateRange && (
                    <p className={cn("mt-0.5 text-sm font-semibold", requestedDays > 0 ? "text-primary" : "text-destructive")}>
                      {requestedDays > 0 ? `${requestedDays} PFFD day${requestedDays === 1 ? "" : "s"}` : "End date is before start date"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="attachment">Attachment Optional</FieldLabel>
              <input
                type="file"
                name="attachment"
                id="attachment"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">PDF or image, up to 5MB.</p>
            </div>

            <div>
              <FieldLabel htmlFor="reason">Reason Optional</FieldLabel>
              <textarea
                name="reason"
                id="reason"
                rows={3}
                className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            <SubmitButton size="sm">Submit Request</SubmitButton>
          </form>
        </section>

        <section className="rounded-xl border bg-card shadow-sm">
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
                  <thead className="border-b bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Duration</th>
                      <th className="px-4 py-3 font-semibold">Days</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Filed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium capitalize">{getLeaveLabel(request.leaveType)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {format(parseISO(request.startDate), "MMM d")} - {format(parseISO(request.endDate), "MMM d, yyyy")}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 p-3 md:hidden">
                {filteredRequests.map((request) => (
                  <article key={request.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold capitalize">{getLeaveLabel(request.leaveType)}</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {format(parseISO(request.startDate), "MMM d")} - {format(parseISO(request.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-lg bg-muted/50 p-2.5">
                        <p className="text-muted-foreground">Days</p>
                        <p className="font-semibold">{request.requestedDays}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5">
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
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
