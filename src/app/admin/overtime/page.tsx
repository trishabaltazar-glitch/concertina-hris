import { format } from "date-fns";
import { CheckCircle2, Paperclip, XCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { updateOvertimeRequestStatus } from "@/app/actions/overtime";
import prisma from "@/lib/prisma";
import { ensureOvertimeRequestTable } from "@/lib/overtime-requests";
import { SubmitButton } from "@/components/ui/submit-button";

export const dynamic = "force-dynamic";

type OvertimeRequestRow = {
  id: string;
  startAt: Date;
  endAt: Date;
  reason: string;
  attachmentName: string;
  status: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export default async function AdminOvertimePage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || (user.role !== "ADMIN" && user.role !== "MANAGER")) redirect("/");

  await ensureOvertimeRequestTable();

  const requests = user.role === "ADMIN"
    ? await prisma.$queryRaw<OvertimeRequestRow[]>`
        SELECT ot."id", ot."startAt", ot."endAt", ot."reason", ot."attachmentName", ot."status", ot."createdAt", u."name" as "userName", u."email" as "userEmail"
        FROM "OvertimeRequest" ot
        INNER JOIN "User" u ON u."id" = ot."userId"
        ORDER BY CASE WHEN ot."status" = 'PENDING' THEN 0 ELSE 1 END, ot."createdAt" DESC
        LIMIT 100
      `
    : await prisma.$queryRaw<OvertimeRequestRow[]>`
        SELECT ot."id", ot."startAt", ot."endAt", ot."reason", ot."attachmentName", ot."status", ot."createdAt", u."name" as "userName", u."email" as "userEmail"
        FROM "OvertimeRequest" ot
        INNER JOIN "User" u ON u."id" = ot."userId"
        WHERE u."managerId" = ${user.id}
          AND u."role" = 'EMPLOYEE'
        ORDER BY CASE WHEN ot."status" = 'PENDING' THEN 0 ELSE 1 END, ot."createdAt" DESC
        LIMIT 100
      `;

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">OT approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">Managers review direct reports. Admins can review all OT requests.</p>
      </div>
      <section className="rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">OT period</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Attachment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No OT requests yet.</td></tr>
              ) : requests.map((request) => (
                <tr key={request.id} className="align-top">
                  <td className="px-4 py-3"><p className="font-medium">{request.userName}</p><p className="text-xs text-muted-foreground">{request.userEmail}</p></td>
                  <td className="px-4 py-3">{format(request.startAt, "MMM d, yyyy h:mm a")} - {format(request.endAt, "MMM d, yyyy h:mm a")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{request.reason}</td>
                  <td className="px-4 py-3"><a href={`/overtime/attachments/${request.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-brand-steel hover:text-brand-red"><Paperclip className="size-3.5" />{request.attachmentName}</a></td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-4 py-3">
                    {request.status === "PENDING" ? (
                      <div className="flex justify-end gap-2">
                        <form action={async () => { "use server"; await updateOvertimeRequestStatus(request.id, "APPROVED"); }}>
                          <SubmitButton variant="success" size="sm" className="h-8 gap-1.5"><CheckCircle2 className="size-3.5" />Approve</SubmitButton>
                        </form>
                        <form action={async () => { "use server"; await updateOvertimeRequestStatus(request.id, "REJECTED"); }}>
                          <SubmitButton variant="destructive-outline" size="sm" className="h-8 gap-1.5"><XCircle className="size-3.5" />Reject</SubmitButton>
                        </form>
                      </div>
                    ) : <span className="block text-right text-xs text-muted-foreground">Reviewed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
