import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ScheduleClientPage } from "./components/schedule-client-page";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";


export const dynamic = "force-dynamic";

type ScheduleOverrideRow = {
  id: string;
  userId: string;
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
};

export default async function AdminSchedulesPage() {
  const session = await auth();
  const sessionUser = session?.user as { id?: string; role?: string } | undefined;

  if (!session || !sessionUser || (sessionUser.role !== "ADMIN" && sessionUser.role !== "MANAGER")) {
    redirect("/");
  }
  await ensureScheduleOverrideTable();

  const [users, scheduleOverrides] = await Promise.all([
    prisma.user.findMany({
      where: sessionUser.role === "ADMIN" ? undefined : { managerId: sessionUser.id, role: "EMPLOYEE" },
      orderBy: { name: 'asc' },
      include: {
        schedules: true,
      }
    }),
    sessionUser.role === "ADMIN"
      ? prisma.$queryRaw<ScheduleOverrideRow[]>`
          SELECT so."id", so."userId", so."date", so."startTime", so."endTime", so."notes"
          FROM "ScheduleOverride" so
          INNER JOIN "User" u ON u."id" = so."userId"
          ORDER BY so."date" ASC
        `
      : prisma.$queryRaw<ScheduleOverrideRow[]>`
          SELECT so."id", so."userId", so."date", so."startTime", so."endTime", so."notes"
          FROM "ScheduleOverride" so
          INNER JOIN "User" u ON u."id" = so."userId"
          WHERE u."managerId" = ${sessionUser.id}
            AND u."role" = 'EMPLOYEE'
          ORDER BY so."date" ASC
        `,
  ]);

  const formattedUsers = users.map((user) => ({
    ...user,
    scheduleOverrides: scheduleOverrides.filter((override) => override.userId === user.id).map((override) => ({
      ...override,
      date: override.date.toISOString(),
    })),
  }));

  return (
    <div className="w-full space-y-8">
      <ScheduleClientPage initialUsers={formattedUsers} />
    </div>
  );
}
