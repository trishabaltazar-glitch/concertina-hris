import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScheduleClientPage } from "./components/schedule-client-page";


export const dynamic = "force-dynamic";

export default async function AdminSchedulesPage() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    redirect("/");
  }

  // Fetch users and their assigned schedules
  const users = await prisma.user.findMany({
    where: sessionUser.role === "ADMIN" ? undefined : { managerId: sessionUser.id },
    orderBy: { name: 'asc' },
    include: {
      schedules: true
    }
  });

  return (
    <div className="w-full space-y-8">
      <ScheduleClientPage initialUsers={users} />
    </div>
  );
}
