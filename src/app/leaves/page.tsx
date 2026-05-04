import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { submitLeaveRequest } from "@/app/actions/leaves";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";


export default async function LeavesPage() {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
        redirect("/login");
    }

    const employeeId = session.user.id;

    const leaveRequests = await prisma.leaveRequest.findMany({
        where: { userId: employeeId },
        orderBy: { createdAt: "desc" },
    });

    const balances = await prisma.leaveBalance.findMany({
        where: { userId: employeeId },
    });

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    {/* Balances */}
                    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 bg-gradient-to-br from-primary/5 to-transparent">
                        <h2 className="font-semibold text-lg mb-4 text-primary">Your Balances</h2>
                        <div className="space-y-4">
                            {balances.map((balance: any) => (
                                <div key={balance.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 backdrop-blur border">
                                    <div>
                                        <p className="font-medium text-sm capitalize">{balance.leaveType === 'LEAVE_CREDITS' ? 'PFFD Credits' : balance.leaveType.toLowerCase()}</p>
                                        <p className="text-xs text-muted-foreground">Available</p>
                                    </div>
                                    <div className="text-xl font-bold text-primary">{balance.balance}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Request Form */}
                    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6">
                        <h2 className="font-semibold text-lg mb-4">New Request</h2>
                        <form action={async (formData) => {
                            "use server";
                            await submitLeaveRequest(formData);
                        }} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block" htmlFor="leaveType">Time-Off Type</label>
                                <input type="hidden" name="leaveType" value="LEAVE_CREDITS" id="leaveType" />
                                <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground items-center">
                                    PFFD Credits
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" htmlFor="startDate">Start Date</label>
                                    <input type="date" name="startDate" id="startDate" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-1.5 block" htmlFor="endDate">End Date</label>
                                    <input type="date" name="endDate" id="endDate" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block" htmlFor="reason">Reason (Optional)</label>
                                <textarea name="reason" id="reason" rows={3} className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"></textarea>
                            </div>
                            <SubmitButton className="w-full mt-2">
                                Submit Request
                            </SubmitButton>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden h-full">
                        <div className="p-6 border-b">
                            <h2 className="font-semibold text-lg">Request History</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-muted/50 text-muted-foreground border-b text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold">Type</th>
                                        <th className="px-6 py-4 font-semibold">Duration</th>
                                        <th className="px-6 py-4 font-semibold">Status</th>
                                        <th className="px-6 py-4 font-semibold">Date Filed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {leaveRequests.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                                                No PFFD requests found.
                                            </td>
                                        </tr>
                                    ) : (
                                        leaveRequests.map((request: any) => (
                                            <tr key={request.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-6 py-4 font-medium capitalize">
                                                    {request.leaveType === 'LEAVE_CREDITS' ? 'PFFD Credits' : request.leaveType.toLowerCase()}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                    {format(request.startDate, "MMM d")} - {format(request.endDate, "MMM d, yyyy")}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${request.status === 'APPROVED'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : request.status === 'REJECTED'
                                                            ? 'bg-destructive/10 text-destructive'
                                                            : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                        {request.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground">
                                                    {format(request.createdAt, "MMM d, yyyy")}
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
        </div>
    );
}
