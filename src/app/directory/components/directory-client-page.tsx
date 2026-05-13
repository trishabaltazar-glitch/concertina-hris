"use client";

import { useMemo, useState } from "react";
import { Phone, Search, UserRound, UsersRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  position: string | null;
  department: string | null;
  contactNumber: string | null;
  managerName: string | null;
};

type DirectoryClientPageProps = {
  users: DirectoryUser[];
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getRoleTone(role: string) {
  if (role === "ADMIN") {
    return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  }

  if (role === "MANAGER") {
    return "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400";
  }

  return "border-border bg-muted text-muted-foreground";
}

function CompactBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function ContactActions({ phone }: { phone: string | null }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {phone && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon-xs" aria-label={`Call ${phone}`}>
              <a href={`tel:${phone}`}>
                <Phone className="size-3.5" />
              </a>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Call</TooltipContent>
        </Tooltip>
      )}
      {!phone && <span className="text-xs text-muted-foreground">-</span>}
    </div>
  );
}

export function DirectoryClientPage({ users }: DirectoryClientPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const departments = useMemo(() => {
    return Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort() as string[];
  }, [users]);

  const roles = useMemo(() => {
    return Array.from(new Set(users.map((user) => user.role))).sort();
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        query === "" ||
        [user.name, user.email, user.role, user.position, user.department, user.managerName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      const matchesDepartment = departmentFilter === "ALL" || user.department === departmentFilter;
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

      return matchesSearch && matchesDepartment && matchesRole;
    });
  }, [departmentFilter, roleFilter, searchQuery, users]);

  const hasFilters = searchQuery !== "" || departmentFilter !== "ALL" || roleFilter !== "ALL";

  function clearFilters() {
    setSearchQuery("");
    setDepartmentFilter("ALL");
    setRoleFilter("ALL");
  }

  return (
    <div className="w-full space-y-4">
      <section className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UsersRound className="size-4" />
            </div>
            <div>
              <h2 className="font-semibold">Team Directory</h2>
              <p className="text-xs text-muted-foreground">
                {filteredUsers.length} of {users.length} team members
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_160px_140px_auto] lg:w-[720px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search team..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Filter by department"
            >
              <option value="ALL">All departments</option>
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Filter by role"
            >
              <option value="ALL">All roles</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <Button type="button" variant="outline" size="sm" onClick={clearFilters} disabled={!hasFilters} className="shadow-none">
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UserRound className="size-5" />
            </div>
            <h3 className="mt-3 font-semibold">{hasFilters ? "No matching team members" : "No team members found"}</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {hasFilters ? "Adjust or clear the filters to broaden the directory." : "Team members will appear here once added."}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Member</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Department</th>
                    <th className="px-4 py-3 font-semibold">Manager</th>
                    <th className="px-4 py-3 text-right font-semibold">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                            {getInitials(user.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-foreground">{user.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <CompactBadge className={getRoleTone(user.role)}>{user.role}</CompactBadge>
                          {user.position && <div className="text-xs text-muted-foreground">{user.position}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.department ? <CompactBadge>{user.department}</CompactBadge> : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.managerName || "-"}</td>
                      <td className="px-4 py-3">
                        <ContactActions phone={user.contactNumber} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 p-3 md:hidden">
              {filteredUsers.map((user) => (
                <article key={user.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{user.name}</h3>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <ContactActions phone={user.contactNumber} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <CompactBadge className={getRoleTone(user.role)}>{user.role}</CompactBadge>
                    {user.department && <CompactBadge>{user.department}</CompactBadge>}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <p className="text-xs text-muted-foreground">Position</p>
                      <p className="truncate font-medium">{user.position || "-"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2.5">
                      <p className="text-xs text-muted-foreground">Manager</p>
                      <p className="truncate font-medium">{user.managerName || "-"}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
