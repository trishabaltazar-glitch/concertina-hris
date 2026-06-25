import { differenceInMinutes, format } from "date-fns";
import { AlertCircle, CalendarDays, Clock3, FileText, Paperclip } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { cancelPendingOvertimeRequest, submitOvertimeRequest, updatePendingOvertimeRequest } from "@/app/actions/overtime";
import prisma from "@/lib/prisma";
import { ensureOvertimeRequestTable } from "@/lib/overtime-requests";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

type OvertimeRequestRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  attachmentName: string;
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

function getDurationLabel(startAt: Date, endAt: Date) {
  const minutes = Math.max(0, differenceInMinutes(endAt, startAt));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export default async function OvertimePage({
  searchParams,
  basePath = "/overtime",
}: {
  searchParams?: Promise<{ status?: string; edit?: string }>;
  basePath?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const statusFilter = STATUS_FILTERS.includes(params?.status as (typeof STATUS_FILTERS)[number])
    ? (params?.status as (typeof STATUS_FILTERS)[number])
    : "ALL";

  let requests: OvertimeRequestRow[] = [];
  let databaseError: string | null = null;

  try {
    await ensureOvertimeRequestTable();
    requests = await prisma.$queryRaw<OvertimeRequestRow[]>`
      SELECT "id", "startAt", "endAt", "reason", "attachmentName", "status", "createdAt"
      FROM "OvertimeRequest"
      WHERE "userId" = ${session.user.id}
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;
  } catch (error) {
    console.error("Failed to load overtime requests:", error);
    databaseError = "OT requests could not be loaded right now. Please refresh after the database connection recovers.";
  }
  const filteredRequests = statusFilter === "ALL" ? requests : requests.filter((request) => request.status === statusFilter);
  const pendingCount = requests.filter((request) => request.status === "PENDING").length;
  const editingRequest = requests.find((request) => request.id === params?.edit && request.status === "PENDING") || null;
  const getStatusHref = (status: (typeof STATUS_FILTERS)[number]) => {
    if (status === "ALL") return basePath;
    return `${basePath}${basePath.includes("?") ? "&" : "?"}status=${status}`;
  };

  return (
    <div className="w-full space-y-5">
      <div className="rounded-lg border border-border bg-background p-4 sm:max-w-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">Pending</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-amber-700">{pendingCount}</p>
          </div>
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Clock3 className="size-3.5" />
          </span>
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">OT requests waiting for review.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{editingRequest ? "Edit Request" : "New Request"}</h2>
              {editingRequest && (
                <Button asChild variant="ghost" size="xs">
                  <a href={basePath}>Cancel edit</a>
                </Button>
              )}
            </div>
          </div>
          <form
            action={async (formData) => {
              "use server";
              if (editingRequest) {
                await updatePendingOvertimeRequest(editingRequest.id, formData);
              } else {
                await submitOvertimeRequest(formData);
              }
            }}
            className="space-y-3 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                OT start date
                <input type="date" name="startDate" defaultValue={editingRequest ? format(editingRequest.startAt, "yyyy-MM-dd") : undefined} required className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                OT start time
                <input type="time" name="startTime" defaultValue={editingRequest ? format(editingRequest.startAt, "HH:mm") : undefined} required className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                OT end date
                <input type="date" name="endDate" defaultValue={editingRequest ? format(editingRequest.endAt, "yyyy-MM-dd") : undefined} required className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                OT end time
                <input type="time" name="endTime" defaultValue={editingRequest ? format(editingRequest.endAt, "HH:mm") : undefined} required className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
            </div>

            <div className="rounded-lg border border-border bg-muted/25 p-3">
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
                  <p className="mt-1 text-sm text-muted-foreground">Submit the exact OT window and supporting file for approval.</p>
                </div>
              </div>
            </div>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Attachment {editingRequest ? "Optional" : "Required"}
              <input type="file" name="attachment" required={!editingRequest} accept="application/pdf,image/png,image/jpeg,image/webp" className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                PDF or image, up to 5MB. {editingRequest ? "Leave blank to keep the current attachment." : ""}
              </span>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Reason
              <textarea name="reason" required rows={3} maxLength={500} defaultValue={editingRequest?.reason} className="flex min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
            </label>

            <SubmitButton size="sm">{editingRequest ? "Save Changes" : "Submit Request"}</SubmitButton>
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
                    <a href={getStatusHref(status)}>
                      {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {databaseError ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">OT requests unavailable</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{databaseError}</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <CalendarDays className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">{statusFilter === "ALL" ? "No OT requests yet" : `No ${statusFilter.toLowerCase()} requests`}</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                {statusFilter === "ALL" ? "Submitted OT requests will appear here with their approval status." : "Try another status filter to view more history."}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">OT period</th>
                      <th className="px-4 py-3 font-semibold">Hours</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Filed</th>
                      <th className="px-4 py-3 font-semibold">Attachment</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          <div>{format(request.startAt, "MMM d, yyyy h:mm a")}</div>
                          <div className="mt-0.5 text-xs">to {format(request.endAt, "MMM d, yyyy h:mm a")}</div>
                          <div className="mt-0.5 max-w-xs truncate text-xs" title={request.reason}>{request.reason}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{getDurationLabel(request.startAt, request.endAt)}</td>
                        <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{format(request.createdAt, "MMM d, yyyy")}</td>
                        <td className="px-4 py-3">
                          <a href={`/overtime/attachments/${request.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-steel hover:text-brand-red">
                            <Paperclip className="size-3" />
                            Attachment
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          {request.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button asChild variant="outline" size="xs">
                                <a href={`${basePath}${basePath.includes("?") ? "&" : "?"}edit=${request.id}`}>Edit</a>
                              </Button>
                              <form
                                action={async () => {
                                  "use server";
                                  await cancelPendingOvertimeRequest(request.id);
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
                        <h3 className="font-semibold">OT Request</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{format(request.startAt, "MMM d, h:mm a")} - {format(request.endAt, "MMM d, h:mm a")}</p>
                      </div>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Hours</p>
                        <p className="font-semibold">{getDurationLabel(request.startAt, request.endAt)}</p>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2.5">
                        <p className="text-muted-foreground">Filed</p>
                        <p className="font-semibold">{format(request.createdAt, "MMM d, yyyy")}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{request.reason}</p>
                    <a href={`/overtime/attachments/${request.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-steel hover:text-brand-red">
                      <Paperclip className="size-3" />
                      View attachment
                    </a>
                    {request.status === "PENDING" && (
                      <div className="mt-3 flex gap-2">
                        <Button asChild variant="outline" size="xs">
                          <a href={`${basePath}${basePath.includes("?") ? "&" : "?"}edit=${request.id}`}>Edit</a>
                        </Button>
                        <form
                          action={async () => {
                            "use server";
                            await cancelPendingOvertimeRequest(request.id);
                          }}
                        >
                          <SubmitButton variant="destructive-outline" size="xs" className="h-7 text-xs">Cancel</SubmitButton>
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
    </div>
  );
}
