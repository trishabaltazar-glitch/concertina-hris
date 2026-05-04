import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScheduleClientPage } from "./components/schedule-client-page";


export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  const session = await auth();
  const sessionUser = session?.user as any;

  if (!session || !sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    redirect("/");
  }

  // Fetch users and their assigned schedules
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    include: {
      schedules: true
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <ScheduleClientPage initialUsers={users} />
    </div>
  );
}
