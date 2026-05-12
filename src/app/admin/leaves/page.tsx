import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { updateLeaveRequestStatus } from "@/app/actions/admin";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";


export const dynamic = "force-dynamic";

export default async function AdminLeavesPage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect("/login");
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "MANAGER") {
        redirect("/");
    }
    const pendingRequests = await prisma.leaveRequest.findMany({
        where: { status: "PENDING" },
        include: { user: true },
        orderBy: { createdAt: "asc" },
    });

    const processedRequests = await prisma.leaveRequest.findMany({
        where: { status: { not: "PENDING" } },
        include: { user: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
    });

    async function withLeaveMeta<T extends { id: string }>(requests: T[]) {
        return Promise.all(
            requests.map(async (request) => {
                const meta = await prisma.$queryRaw<{ requestedDays: number; dayType: string; attachmentName: string | null }[]>`
                    SELECT "requestedDays", "dayType", "attachmentName"
                    FROM "LeaveRequest"
                    WHERE "id" = ${request.id}
                    LIMIT 1
                `;

                return {
                    ...request,
                    requestedDays: meta[0]?.requestedDays || 1,
                    dayType: meta[0]?.dayType || "FULL_DAY",
                    attachmentName: meta[0]?.attachmentName || null,
                };
            })
        );
    }

    const pendingRequestsWithMeta = await withLeaveMeta(pendingRequests);
    const processedRequestsWithMeta = await withLeaveMeta(processedRequests);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="space-y-6">
                <h2 className="font-semibold text-xl">Pending Requests</h2>
                {pendingRequestsWithMeta.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-card/50 text-card-foreground p-12 text-center text-muted-foreground">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 mb-4">
                            <span className="text-primary text-xl">✨</span>
                        </div>
                        <p>All caught up! No pending PFFD requests to review.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pendingRequestsWithMeta.map((request: any) => (
                            <div key={request.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-bold text-lg">{request.user.name}</h3>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                            Pending
                                        </span>
                                    </div>
                                    <p className="text-muted-foreground text-sm font-medium">
                                        <span className="capitalize text-foreground">{request.leaveType === 'LEAVE_CREDITS' ? 'PFFD Credits' : request.leaveType.toLowerCase() + ' PFFD'}</span> • {request.dayType === "HALF_DAY" ? `${format(request.startDate, "MMM d, yyyy")} (half-day)` : `${format(request.startDate, "MMM d")} to ${format(request.endDate, "MMM d, yyyy")}`} • {request.requestedDays} day{request.requestedDays === 1 ? "" : "s"}
                                    </p>
                                    {request.attachmentName && (
                                        <a href={`/leaves/attachments/${request.id}`} className="text-xs font-semibold text-brand-steel hover:text-brand-red">
                                            View attachment
                                        </a>
                                    )}
                                    {request.reason && (
                                        <p className="text-sm mt-3 pt-3 border-t italic text-muted-foreground max-w-2xl">
                                            "{request.reason}"
                                        </p>
                                    )}
                                </div>

                                <div className="flex sm:flex-col gap-2 shrink-0">
                                    <form action={async () => {
                                        "use server";
                                        await updateLeaveRequestStatus(request.id, "APPROVED");
                                    }}>
                                        <SubmitButton variant="success" className="w-full sm:w-32">
                                            Approve
                                        </SubmitButton>
                                    </form>
                                    <form action={async () => {
                                        "use server";
                                        await updateLeaveRequestStatus(request.id, "REJECTED");
                                    }}>
                                        <SubmitButton variant="destructive-outline" className="w-full sm:w-32">
                                            Reject
                                        </SubmitButton>
                                    </form>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="pt-8 space-y-6">
                <h2 className="font-semibold text-xl">Recently Processed</h2>
                <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Employee</th>
                                    <th className="px-6 py-4 font-semibold">Type</th>
                                    <th className="px-6 py-4 font-semibold">Dates</th>
                                    <th className="px-6 py-4 font-semibold">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {processedRequestsWithMeta.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                            No processed history.
                                        </td>
                                    </tr>
                                ) : (
                                    processedRequestsWithMeta.map((request: any) => (
                                        <tr key={request.id} className="hover:bg-muted/50 transition-colors">
                                            <td className="px-6 py-4 font-medium">
                                                {request.user.name}
                                            </td>
                                            <td className="px-6 py-4 capitalize">
                                                {request.leaveType === 'LEAVE_CREDITS' ? 'PFFD Credits' : request.leaveType.toLowerCase()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                {request.dayType === "HALF_DAY" ? `${format(request.startDate, "MMM d, yyyy")} (half-day)` : `${format(request.startDate, "MMM d")} - ${format(request.endDate, "MMM d, yyyy")}`} • {request.requestedDays} day{request.requestedDays === 1 ? "" : "s"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${request.status === 'APPROVED'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : 'bg-destructive/10 text-destructive'
                                                    }`}>
                                                    {request.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
