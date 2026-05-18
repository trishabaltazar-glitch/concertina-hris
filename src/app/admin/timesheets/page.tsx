import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TimeLogsClientPage } from "./components/time-logs-client-page";
import { format } from "date-fns";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { updateManualTimeEntryRequestStatus } from "@/app/actions/admin";
import { SubmitButton } from "@/components/ui/submit-button";


export const dynamic = "force-dynamic";

type ManualTimeEntryRequest = {
    id: string;
    clockIn: Date;
    clockOut: Date;
    reason: string | null;
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

    return (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
            {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
    );
}

export default async function AdminTimesheetsPage() {
    const session = await auth();
    const user = session?.user as any;
    if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        redirect("/login");
    }

    const [timeLogs, manualRequests] = await Promise.all([
        prisma.timeLog.findMany({
            where: user.role === "ADMIN" ? undefined : { user: { managerId: user.id } },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        role: true,
                    }
                }
            },
            orderBy: { clockIn: "desc" },
            take: 1000, // Show last 1000 logs across the company to allow deep client-side filtering
        }),
        user.role === "ADMIN"
            ? prisma.$queryRaw<ManualTimeEntryRequest[]>`
                SELECT
                    ter."id",
                    ter."clockIn",
                    ter."clockOut",
                    ter."reason",
                    ter."status",
                    ter."createdAt",
                    u."name" as "userName",
                    u."email" as "userEmail"
                FROM "TimeEntryRequest" ter
                INNER JOIN "User" u ON u."id" = ter."userId"
                ORDER BY
                    CASE WHEN ter."status" = 'PENDING' THEN 0 ELSE 1 END,
                    ter."createdAt" DESC
                LIMIT 50
            `
            : prisma.$queryRaw<ManualTimeEntryRequest[]>`
                SELECT
                    ter."id",
                    ter."clockIn",
                    ter."clockOut",
                    ter."reason",
                    ter."status",
                    ter."createdAt",
                    u."name" as "userName",
                    u."email" as "userEmail"
                FROM "TimeEntryRequest" ter
                INNER JOIN "User" u ON u."id" = ter."userId"
                WHERE u."managerId" = ${user.id}
                ORDER BY
                    CASE WHEN ter."status" = 'PENDING' THEN 0 ELSE 1 END,
                    ter."createdAt" DESC
                LIMIT 50
            `,
    ]);

    const pendingRequests = manualRequests.filter((request) => request.status === "PENDING").length;

    return (
        <div className="w-full space-y-6">
            <section className="rounded-2xl border bg-card shadow-sm">
                <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                                <Clock3 className="size-3.5" />
                            </span>
                            <h1 className="text-sm font-semibold text-foreground">Manual time entry approvals</h1>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Review employee-submitted time corrections before they become time logs.
                        </p>
                    </div>
                    <span className="w-fit rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {pendingRequests} pending
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Employee</th>
                                <th className="px-4 py-3 font-semibold">Requested time</th>
                                <th className="px-4 py-3 font-semibold">Reason</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Submitted</th>
                                <th className="px-4 py-3 text-right font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {manualRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                                        No manual entry requests yet.
                                    </td>
                                </tr>
                            ) : (
                                manualRequests.map((request) => (
                                    <tr key={request.id} className="align-top transition-colors hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-foreground">{request.userName}</p>
                                            <p className="mt-0.5 text-xs text-muted-foreground">{request.userEmail}</p>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            <p className="font-medium text-foreground">{format(request.clockIn, "MMM d, yyyy")}</p>
                                            <p className="mt-0.5 text-xs">
                                                {format(request.clockIn, "h:mm a")} - {format(request.clockOut, "h:mm a")}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="max-w-sm truncate text-muted-foreground" title={request.reason || undefined}>
                                                {request.reason || "-"}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={request.status} />
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {format(request.createdAt, "MMM d, yyyy")}
                                        </td>
                                        <td className="px-4 py-3">
                                            {request.status === "PENDING" ? (
                                                <div className="flex justify-end gap-2">
                                                    <form
                                                        action={async () => {
                                                            "use server";
                                                            await updateManualTimeEntryRequestStatus(request.id, "APPROVED");
                                                        }}
                                                    >
                                                        <SubmitButton variant="success" size="sm" className="h-8 gap-1.5">
                                                            <CheckCircle2 className="size-3.5" />
                                                            Approve
                                                        </SubmitButton>
                                                    </form>
                                                    <form
                                                        action={async () => {
                                                            "use server";
                                                            await updateManualTimeEntryRequestStatus(request.id, "REJECTED");
                                                        }}
                                                    >
                                                        <SubmitButton variant="destructive-outline" size="sm" className="h-8 gap-1.5">
                                                            <XCircle className="size-3.5" />
                                                            Reject
                                                        </SubmitButton>
                                                    </form>
                                                </div>
                                            ) : (
                                                <span className="block text-right text-xs text-muted-foreground">Reviewed</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <TimeLogsClientPage initialLogs={timeLogs} />
        </div>
    );
}
