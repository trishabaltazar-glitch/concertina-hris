import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Users } from "lucide-react";

import { assignHolidayToTeamMembers, deleteHolidayAssignment } from "@/app/actions/holidays";
import { ScheduleClientPage } from "@/app/admin/schedules/components/schedule-client-page";
import { EmployeeClientPage } from "@/app/admin/employees/components/employee-client-page";
import { SubmitButton } from "@/components/ui/submit-button";
import { ensureScheduleOverrideTable } from "@/lib/schedule-overrides";
import prisma from "@/lib/prisma";

type ManagementUser = {
  id: string;
  role: string;
};

type ScheduleOverrideRow = {
  id: string;
  userId: string;
  date: Date;
  startTime: string;
  endTime: string;
  notes: string | null;
};

type HolidayAssignment = {
  id: string;
  name: string;
  date: Date;
  notes: string | null;
  createdAt: Date;
  userName: string;
  userEmail: string;
  assignedByName: string;
};

export async function TeamManagementPanel({ user }: { user: ManagementUser }) {
  const isAdmin = user.role === "ADMIN";

  const [users, managers] = await Promise.all([
    prisma.user.findMany({
      where: isAdmin ? undefined : { managerId: user.id },
      orderBy: { name: "asc" },
      include: {
        manager: {
          select: { id: true, name: true },
        },
        teamMembers: {
          select: { id: true },
        },
        leaveBalances: {
          where: { leaveType: "LEAVE_CREDITS" },
        },
      },
    }),
    isAdmin
      ? prisma.user.findMany({
        where: {
          role: "MANAGER",
          isActive: true,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      })
      : Promise.resolve([]),
  ]);

  const formattedUsers = users.map((item) => ({
    id: item.id,
    name: item.name,
    email: item.email,
    role: item.role,
    position: item.position,
    department: item.department,
    dateHired: item.dateHired ? format(item.dateHired, "MMM d, yyyy") : null,
    dateHiredInput: item.dateHired ? format(item.dateHired, "yyyy-MM-dd") : "",
    contactNumber: item.contactNumber,
    emergencyContact: item.emergencyContact,
    address: item.address,
    icId: item.icId,
    managerId: item.managerId,
    managerName: item.manager?.name ?? null,
    directReportCount: item.teamMembers.length,
    isActive: item.isActive,
    invitedAt: item.invitedAt ? format(item.invitedAt, "MMM d, yyyy") : null,
    activatedAt: item.activatedAt ? format(item.activatedAt, "MMM d, yyyy") : null,
    inviteTokenExpiresAt: item.inviteTokenExpiresAt ? item.inviteTokenExpiresAt.toISOString() : null,
    hasPendingInvite: Boolean(item.inviteToken && item.inviteTokenExpiresAt && item.inviteTokenExpiresAt > new Date()),
    leaveBalance: item.leaveBalances[0]?.balance || 0,
    joined: format(item.createdAt, "MMM d, yyyy"),
  }));

  return (
    <EmployeeClientPage
      initialUsers={formattedUsers}
      managers={managers}
      currentUserRole={user.role}
    />
  );
}

export async function SchedulesManagerPanel({ user }: { user: ManagementUser }) {
  await ensureScheduleOverrideTable();

  const [users, scheduleOverrides] = await Promise.all([
    prisma.user.findMany({
      where: user.role === "ADMIN" ? undefined : { managerId: user.id, role: "EMPLOYEE" },
      orderBy: { name: "asc" },
      include: {
        schedules: true,
      },
    }),
    user.role === "ADMIN"
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
        WHERE u."managerId" = ${user.id}
          AND u."role" = 'EMPLOYEE'
        ORDER BY so."date" ASC
      `,
  ]);

  const formattedUsers = users.map((item) => ({
    ...item,
    scheduleOverrides: scheduleOverrides.filter((override) => override.userId === item.id).map((override) => ({
      ...override,
      date: override.date.toISOString(),
    })),
  }));

  return <ScheduleClientPage initialUsers={formattedUsers} />;
}

export async function HolidayAssignmentsPanel({ user }: { user: ManagementUser }) {
  const [teamMembers, assignments] = await Promise.all([
    prisma.user.findMany({
      where: user.role === "ADMIN"
        ? { isActive: true }
        : { managerId: user.id, role: "EMPLOYEE", isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
      },
    }),
    user.role === "ADMIN"
      ? prisma.$queryRaw<HolidayAssignment[]>`
        SELECT
          ha."id",
          ha."name",
          ha."date",
          ha."notes",
          ha."createdAt",
          u."name" as "userName",
          u."email" as "userEmail",
          assigner."name" as "assignedByName"
        FROM "HolidayAssignment" ha
        INNER JOIN "User" u ON u."id" = ha."userId"
        INNER JOIN "User" assigner ON assigner."id" = ha."assignedById"
        ORDER BY ha."date" DESC, ha."createdAt" DESC
        LIMIT 100
      `
      : prisma.$queryRaw<HolidayAssignment[]>`
        SELECT
          ha."id",
          ha."name",
          ha."date",
          ha."notes",
          ha."createdAt",
          u."name" as "userName",
          u."email" as "userEmail",
          assigner."name" as "assignedByName"
        FROM "HolidayAssignment" ha
        INNER JOIN "User" u ON u."id" = ha."userId"
        INNER JOIN "User" assigner ON assigner."id" = ha."assignedById"
        WHERE u."managerId" = ${user.id}
          AND u."role" = 'EMPLOYEE'
        ORDER BY ha."date" DESC, ha."createdAt" DESC
        LIMIT 100
      `,
  ]);

  return (
    <div className="w-full space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-lg border border-border bg-background">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                <CalendarDays className="size-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-foreground">Assign holiday</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a date and the employees covered by the client holiday advisory.
            </p>
          </div>

          <form action={assignHolidayToTeamMembers} className="space-y-4 px-4 py-4">
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Holiday name
              <input
                type="text"
                name="name"
                required
                maxLength={120}
                placeholder="Example: US Thanksgiving"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Date
              <input
                type="date"
                name="date"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Notes
              <textarea
                name="notes"
                rows={3}
                maxLength={500}
                placeholder="Optional client advisory details"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Employees</p>
                <span className="text-xs text-muted-foreground">{teamMembers.length} available</span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-2">
                {teamMembers.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No team members available.
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50"
                    >
                      <input type="checkbox" name="userIds" value={member.id} className="mt-1 size-4" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{member.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <SubmitButton size="sm" className="w-full">
              Assign holiday
            </SubmitButton>
          </form>
        </section>

        <section className="rounded-lg border border-border bg-background">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                  <Users className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Assignment history</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest employee-specific holiday assignments.
              </p>
            </div>
            <span className="w-fit rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {assignments.length} shown
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Employee</th>
                  <th className="px-4 py-3 font-semibold">Holiday</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Assigned by</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      No holiday assignments yet.
                    </td>
                  </tr>
                ) : (
                  assignments.map((assignment) => (
                    <tr key={assignment.id} className="align-top transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{assignment.userName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{assignment.userEmail}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          <span className="font-medium text-foreground">{assignment.name}</span>
                        </div>
                        {assignment.notes && (
                          <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground" title={assignment.notes}>
                            {assignment.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{format(assignment.date, "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{assignment.assignedByName}</td>
                      <td className="px-4 py-3">
                        <form
                          action={async () => {
                            "use server";
                            await deleteHolidayAssignment(assignment.id);
                          }}
                          className="flex justify-end"
                        >
                          <SubmitButton variant="destructive-outline" size="sm" className="h-8 text-xs">
                            Remove
                          </SubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
