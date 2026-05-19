import { differenceInMinutes, format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock3, FileText } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  cancelPendingManualTimeEntryRequest,
  submitManualTimeEntryRequest,
} from "@/app/actions/time";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

type ManualTimeEntryRequest = {
  id: string;
  clockIn: Date;
  clockOut: Date;
  reason: string | null;
  status: string;
  createdAt: Date;
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", styles)}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

function getDurationLabel(clockIn: Date, clockOut: Date) {
  const minutes = Math.max(0, differenceInMinutes(clockOut, clockIn));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export default async function TimeCorrectionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const statusFilter = STATUS_FILTERS.includes(params?.status as (typeof STATUS_FILTERS)[number])
    ? (params?.status as (typeof STATUS_FILTERS)[number])
    : "ALL";

  const today = new Date();
  const requests = await prisma.$queryRaw<ManualTimeEntryRequest[]>`
    SELECT "id", "clockIn", "clockOut", "reason", "status", "createdAt"
    FROM "TimeEntryRequest"
    WHERE "userId" = ${session.user.id}
    ORDER BY "createdAt" DESC
    LIMIT 50
  `;
  const filteredRequests = statusFilter === "ALL" ? requests : requests.filter((request) => request.status === statusFilter);
  const pendingCount = requests.filter((request) => request.status === "PENDING").length;
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const correctedHours = requests.reduce((sum, request) => sum + differenceInMinutes(request.clockOut, request.clockIn) / 60, 0);

  const summaryItems = [
    { label: "Total filed", value: requests.length, helper: "requests", icon: FileText, className: "text-foreground", iconClassName: "bg-muted text-muted-foreground" },
    { label: "Pending", value: pendingCount, helper: "waiting for review", icon: Clock3, className: "text-amber-700", iconClassName: "bg-amber-100 text-amber-700" },
    { label: "Approved", value: approvedCount, helper: `${correctedHours.toFixed(1).replace(".0", "")} corrected hours filed`, icon: CheckCircle2, className: "text-emerald-700", iconClassName: "bg-emerald-100 text-emerald-700" },
  ];

  return (
    <div className="w-full space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className={cn("mt-2 text-2xl font-semibold tracking-tight", item.className)}>{item.value}</p>
                </div>
                <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md", item.iconClassName)}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{item.helper}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">New Request</h2>
          </div>
          <form
            action={async (formData) => {
              "use server";
              await submitManualTimeEntryRequest(formData);
            }}
            className="space-y-3 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                Date
                <input type="date" name="date" defaultValue={format(today, "yyyy-MM-dd")} required className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                Clock in
                <input type="time" name="clockIn" required className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                Clock out
                <input type="time" name="clockOut" required className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
            </div>

            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="mt-1 text-sm text-muted-foreground">Submit missed or corrected hours for manager approval.</p>
                </div>
              </div>
            </div>

            <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
              Reason
              <textarea name="reason" required rows={3} maxLength={500} placeholder="Example: Forgot to clock in after client call." className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </label>

            <SubmitButton size="sm">Submit Request</SubmitButton>
          </form>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Request History</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{filteredRequests.length} request{filteredRequests.length === 1 ? "" : "s"} shown</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((status) => (
                  <Button key={status} asChild variant={statusFilter === status ? "secondary" : "outline"} size="xs" className="shadow-none">
                    <a href={status === "ALL" ? "/time-corrections" : `/time-corrections?status=${status}`}>
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                    </a>
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
              <h3 className="mt-3 font-semibold">{statusFilter === "ALL" ? "No time correction requests yet" : `No ${statusFilter.toLowerCase()} requests`}</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                {statusFilter === "ALL" ? "Submitted time corrections will appear here with their approval status." : "Try another status filter to view more history."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Corrected period</th>
                      <th className="px-4 py-3 font-semibold">Hours</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Filed</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          <div>{format(request.clockIn, "MMM d, yyyy h:mm a")} - {format(request.clockOut, "h:mm a")}</div>
                          <div className="mt-0.5 max-w-xs truncate text-xs" title={request.reason || undefined}>{request.reason || "No reason provided"}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{getDurationLabel(request.clockIn, request.clockOut)}</td>
                        <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{format(request.createdAt, "MMM d, yyyy")}</td>
                        <td className="px-4 py-3">
                          {request.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <form
                                action={async () => {
                                  "use server";
                                  await cancelPendingManualTimeEntryRequest(request.id);
                                }}
                              >
                                <SubmitButton variant="destructive-outline" size="xs" className="h-7 text-xs">Cancel</SubmitButton>
                              </form>
                            </div>
                          ) : <span className="block text-right text-xs text-muted-foreground">Reviewed</span>}
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
                        <h3 className="font-semibold">Time Correction</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{format(request.clockIn, "MMM d, h:mm a")} - {format(request.clockOut, "h:mm a")}</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Hours</p>
                        <p className="font-semibold">{getDurationLabel(request.clockIn, request.clockOut)}</p>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Filed</p>
                        <p className="font-semibold">{format(request.createdAt, "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{request.reason || "No reason provided"}</p>
                    {request.status === "PENDING" && (
                      <form
                        action={async () => {
                          "use server";
                          await cancelPendingManualTimeEntryRequest(request.id);
                        }}
                        className="mt-3"
                      >
                        <SubmitButton variant="destructive-outline" size="xs" className="h-7 text-xs">Cancel</SubmitButton>
                      </form>
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
