import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { TimeLogsClientPage } from "./components/time-logs-client-page";


export const dynamic = "force-dynamic";

export default async function AdminTimesheetsPage() {
    const session = await auth();
    const user = session?.user as any;
    if (!session || !user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
        redirect("/login");
    }

    const timeLogs = await prisma.timeLog.findMany({
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                }
            }
        },
        orderBy: { clockIn: "desc" },
        take: 1000, // Show last 1000 logs across the company to allow deep client-side filtering
    });

    return (
        <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
            <TimeLogsClientPage initialLogs={timeLogs} />
        </div>
    );
}
