"use client";

import { useMemo, useState } from "react";
import {
    BriefcaseBusiness,
    Check,
    Eye,
    Loader2,
    MailPlus,
    Pencil,
    Plus,
    Search,
    ShieldAlert,
    User,
    UserCheck,
    UserCog,
    UserMinus,
    UsersRound,
    X,
} from "lucide-react";

import { AddEmployeeForm } from "./add-employee-form";
import {
    bulkUpdateEmployees,
    deactivateEmployee,
    reactivateEmployee,
    resendEmployeeInvite,
    updateEmployeePffdBalance,
    updateEmployeeProfile,
} from "@/app/actions/employees";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ManagerOption = {
    id: string;
    name: string;
    email: string;
};

type EmployeeData = {
    id: string;
    name: string;
    email: string;
    role: string;
    position: string | null;
    department: string | null;
    dateHired: string | null;
    dateHiredInput: string;
    contactNumber: string | null;
    emergencyContact: string | null;
    address: string | null;
    icId: string | null;
    managerId: string | null;
    managerName: string | null;
    directReportCount: number;
    isActive: boolean;
    invitedAt: string | null;
    activatedAt: string | null;
    inviteTokenExpiresAt: string | null;
    hasPendingInvite: boolean;
    leaveBalance: number;
    joined: string;
};

type EmployeeClientPageProps = {
    initialUsers: EmployeeData[];
    managers: ManagerOption[];
    currentUserRole: string;
};

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}

function getAccountStatus(user: EmployeeData) {
    if (user.isActive) {
        return { label: "Active", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    }

    if (user.hasPendingInvite) {
        return { label: "Invited", className: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300" };
    }

    if (user.inviteTokenExpiresAt) {
        return { label: "Invite expired", className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
    }

    return { label: "Inactive", className: "border-border bg-muted text-muted-foreground" };
}

function formatDateInputLabel(value: string | null) {
    if (!value) return null;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
            role === "ADMIN"
                ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
                : role === "MANAGER"
                    ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : "border-border bg-muted text-muted-foreground"
        )}>
            {role === "ADMIN" ? <ShieldAlert className="size-3" /> : <User className="size-3" />}
            {role}
        </span>
    );
}

function StatusBadge({ user }: { user: EmployeeData }) {
    const status = getAccountStatus(user);
    return <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-medium", status.className)}>{status.label}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-lg border bg-background p-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="mt-1 truncate text-sm font-medium text-foreground">{value || "-"}</div>
        </div>
    );
}

export function EmployeeClientPage({ initialUsers, managers, currentUserRole }: EmployeeClientPageProps) {
    const [users, setUsers] = useState(initialUsers);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("ALL");
    const [managerFilter, setManagerFilter] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [viewingUser, setViewingUser] = useState<EmployeeData | null>(null);
    const [editingUser, setEditingUser] = useState<EmployeeData | null>(null);
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const [inviteNotice, setInviteNotice] = useState<string | null>(null);
    const [bulkDepartment, setBulkDepartment] = useState("");
    const [bulkManagerId, setBulkManagerId] = useState("");
    const [isBulkSaving, setIsBulkSaving] = useState(false);
    const [editingBalanceUserId, setEditingBalanceUserId] = useState<string | null>(null);
    const [balanceValue, setBalanceValue] = useState("");
    const [isSavingBalance, setIsSavingBalance] = useState(false);
    const isAdmin = currentUserRole === "ADMIN";

    const departments = useMemo(() => {
        return Array.from(new Set(users.map((user) => user.department).filter(Boolean))).sort() as string[];
    }, [users]);

    const filteredUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return users.filter((user) => {
            const status = getAccountStatus(user).label;
            const matchesSearch =
                query === "" ||
                [user.name, user.email, user.role, user.position, user.department, user.managerName, user.contactNumber, user.icId]
                    .filter(Boolean)
                    .some((value) => value!.toLowerCase().includes(query));
            const matchesDepartment = departmentFilter === "ALL" || user.department === departmentFilter;
            const matchesManager = managerFilter === "ALL" || (managerFilter === "NONE" ? !user.managerId : user.managerId === managerFilter);
            const matchesStatus = statusFilter === "ALL" || status === statusFilter;

            return matchesSearch && matchesDepartment && matchesManager && matchesStatus;
        });
    }, [departmentFilter, managerFilter, searchQuery, statusFilter, users]);

    const activeCount = users.filter((user) => user.isActive).length;
    const invitedCount = users.filter((user) => user.hasPendingInvite).length;
    const managerCount = users.filter((user) => user.role === "MANAGER").length;
    const hasFilters = searchQuery !== "" || departmentFilter !== "ALL" || managerFilter !== "ALL" || statusFilter !== "ALL";

    const refreshUser = (userId: string, updates: Partial<EmployeeData>) => {
        setUsers((currentUsers) => currentUsers.map((user) => (user.id === userId ? { ...user, ...updates } : user)));
    };

    const toggleSelection = (userId: string) => {
        setSelectedUserIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
    };

    const toggleAllFiltered = () => {
        const filteredIds = filteredUsers.map((user) => user.id);
        const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedUserIds.includes(id));
        setSelectedUserIds(allSelected ? selectedUserIds.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...selectedUserIds, ...filteredIds])));
    };

    const clearFilters = () => {
        setSearchQuery("");
        setDepartmentFilter("ALL");
        setManagerFilter("ALL");
        setStatusFilter("ALL");
    };

    const startBalanceEdit = (user: EmployeeData) => {
        setEditingBalanceUserId(user.id);
        setBalanceValue(String(user.leaveBalance));
    };

    const cancelBalanceEdit = () => {
        setEditingBalanceUserId(null);
        setBalanceValue("");
    };

    const saveBalanceEdit = async (user: EmployeeData) => {
        const nextBalance = Number.parseFloat(balanceValue);
        setIsSavingBalance(true);
        try {
            const result = await updateEmployeePffdBalance(user.id, nextBalance);
            if (result.success) {
                refreshUser(user.id, { leaveBalance: nextBalance });
                cancelBalanceEdit();
            } else {
                alert(result.error || "Failed to update PFFD balance.");
            }
        } finally {
            setIsSavingBalance(false);
        }
    };

    const submitProfileEdit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingUser) return;

        setIsSavingProfile(true);
        try {
            const formData = new FormData(event.currentTarget);
            const result = await updateEmployeeProfile(editingUser.id, formData);
            if (!result.success) {
                alert(result.error || "Failed to update employee.");
                return;
            }

            const managerId = (formData.get("managerId") as string) || null;
            const managerName = managers.find((manager) => manager.id === managerId)?.name ?? null;
            const dateHiredInput = (formData.get("dateHired") as string) || "";
            refreshUser(editingUser.id, {
                name: String(formData.get("name") || ""),
                email: String(formData.get("email") || ""),
                role: String(formData.get("role") || "EMPLOYEE"),
                position: (formData.get("position") as string) || null,
                department: (formData.get("department") as string) || null,
                dateHired: formatDateInputLabel(dateHiredInput),
                dateHiredInput,
                contactNumber: (formData.get("contactNumber") as string) || null,
                emergencyContact: (formData.get("emergencyContact") as string) || null,
                address: (formData.get("address") as string) || null,
                icId: (formData.get("icId") as string) || null,
                managerId,
                managerName,
            });
            setEditingUser(null);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleResendInvite = async (user: EmployeeData) => {
        setPendingUserId(user.id);
        setInviteNotice(null);
        try {
            const result = await resendEmployeeInvite(user.id);
            if (result.success) {
                refreshUser(user.id, {
                    hasPendingInvite: true,
                    inviteTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
                });
                setInviteNotice(result.emailSent ? `Setup email sent to ${user.email}.` : `Setup link for ${user.email}: ${result.inviteLink}`);
            } else {
                alert(result.error || "Failed to resend invite.");
            }
        } finally {
            setPendingUserId(null);
        }
    };

    const handleAccountToggle = async (user: EmployeeData) => {
        const action = user.isActive ? deactivateEmployee : reactivateEmployee;
        setPendingUserId(user.id);
        try {
            const result = await action(user.id);
            if (result.success) {
                refreshUser(user.id, {
                    isActive: !user.isActive,
                    hasPendingInvite: false,
                    inviteTokenExpiresAt: null,
                });
            } else {
                alert(result.error || "Failed to update account status.");
            }
        } finally {
            setPendingUserId(null);
        }
    };

    const applyBulkUpdate = async () => {
        if (selectedUserIds.length === 0) return;

        const updates: { department?: string; managerId?: string } = {};
        if (bulkDepartment.trim()) updates.department = bulkDepartment;
        if (bulkManagerId !== "") updates.managerId = bulkManagerId === "NONE" ? "" : bulkManagerId;

        if (Object.keys(updates).length === 0) {
            alert("Choose a department or manager to apply.");
            return;
        }

        setIsBulkSaving(true);
        try {
            const result = await bulkUpdateEmployees(selectedUserIds, updates);
            if (!result.success) {
                alert(result.error || "Failed to update selected employees.");
                return;
            }

            const managerName = bulkManagerId && bulkManagerId !== "NONE" ? managers.find((manager) => manager.id === bulkManagerId)?.name ?? null : null;
            setUsers((currentUsers) =>
                currentUsers.map((user) =>
                    selectedUserIds.includes(user.id)
                        ? {
                            ...user,
                            department: updates.department !== undefined ? updates.department || null : user.department,
                            managerId: updates.managerId !== undefined ? updates.managerId || null : user.managerId,
                            managerName: updates.managerId !== undefined ? managerName : user.managerName,
                        }
                        : user
                )
            );
            setSelectedUserIds([]);
            setBulkDepartment("");
            setBulkManagerId("");
        } finally {
            setIsBulkSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Team members" value={users.length} helper={`${filteredUsers.length} in current view`} icon={UsersRound} />
                <Metric label="Active accounts" value={activeCount} helper={`${invitedCount} pending invite`} icon={UserCheck} />
                <Metric label="Managers" value={managerCount} helper="Active reporting groups" icon={UserCog} />
                <Metric label="Departments" value={departments.length} helper="Used in team filters" icon={BriefcaseBusiness} />
            </div>

            <section className="rounded-xl border bg-card shadow-sm">
                <div className="border-b px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_160px_170px_150px_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="h-8 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            />
                        </div>

                        <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <option value="ALL">All departments</option>
                            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                        </select>

                        <select value={managerFilter} onChange={(event) => setManagerFilter(event.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <option value="ALL">All managers</option>
                            <option value="NONE">No manager</option>
                            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                        </select>

                        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <option value="ALL">All statuses</option>
                            <option value="Active">Active</option>
                            <option value="Invited">Invited</option>
                            <option value="Invite expired">Invite expired</option>
                            <option value="Inactive">Inactive</option>
                        </select>

                        <Button type="button" variant="outline" size="sm" onClick={clearFilters} disabled={!hasFilters} className="shadow-none">
                            <X className="size-3.5" />
                            Clear
                        </Button>
                    </div>
                </div>

                {isAdmin && (
                    <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                                {selectedUserIds.length} selected
                            </span>
                            <input
                                value={bulkDepartment}
                                onChange={(event) => setBulkDepartment(event.target.value)}
                                placeholder="Set department"
                                className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            />
                            <select value={bulkManagerId} onChange={(event) => setBulkManagerId(event.target.value)} className="h-8 w-48 rounded-lg border border-input bg-background px-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                <option value="">Keep manager</option>
                                <option value="NONE">No manager</option>
                                {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                            </select>
                            <Button type="button" variant="outline" size="sm" onClick={applyBulkUpdate} disabled={selectedUserIds.length === 0 || isBulkSaving}>
                                {isBulkSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                Apply
                            </Button>
                        </div>

                        <Button type="button" onClick={() => setIsAddModalOpen(true)} className="w-fit">
                            <Plus className="size-4" />
                            Add Employee
                        </Button>
                    </div>
                )}

                {inviteNotice && (
                    <div className="border-b bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                        {inviteNotice}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                                {isAdmin && (
                                    <th className="w-10 px-4 py-3">
                                        <input type="checkbox" checked={filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id))} onChange={toggleAllFiltered} aria-label="Select all filtered employees" />
                                    </th>
                                )}
                                <th className="px-4 py-3 font-semibold">Employee</th>
                                <th className="px-4 py-3 font-semibold">Role</th>
                                <th className="px-4 py-3 font-semibold">Department</th>
                                <th className="px-4 py-3 font-semibold">Manager</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 text-center font-semibold">PFFD</th>
                                <th className="px-4 py-3 text-right font-semibold">Date hired</th>
                                <th className="px-4 py-3 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 9 : 8} className="px-4 py-10 text-center text-muted-foreground">
                                        No employees match the current filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="transition-colors hover:bg-muted/40">
                                        {isAdmin && (
                                            <td className="px-4 py-3">
                                                <input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleSelection(user.id)} aria-label={`Select ${user.name}`} />
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
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
                                                <RoleBadge role={user.role} />
                                                <div className="text-xs text-muted-foreground">{user.position || "-"}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{user.department || <span className="text-muted-foreground">-</span>}</td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {user.managerName || "-"}
                                            {user.directReportCount > 0 && <span className="ml-2 rounded-md border px-1.5 py-0.5 text-[11px]">{user.directReportCount} reports</span>}
                                        </td>
                                        <td className="px-4 py-3"><StatusBadge user={user} /></td>
                                        <td className="px-4 py-3 text-center">
                                            {isAdmin && editingBalanceUserId === user.id ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <input type="number" min="0" step="0.5" value={balanceValue} onChange={(event) => setBalanceValue(event.target.value)} className="h-8 w-20 rounded-md border border-input bg-background px-2 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/40" />
                                                    <Button type="button" size="icon-sm" variant="success" disabled={isSavingBalance} onClick={() => saveBalanceEdit(user)} aria-label={`Save PFFD balance for ${user.name}`}>
                                                        {isSavingBalance ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                                                    </Button>
                                                    <Button type="button" size="icon-sm" variant="ghost" disabled={isSavingBalance} onClick={cancelBalanceEdit} aria-label="Cancel PFFD balance edit">
                                                        <X className="size-3.5" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <button type="button" disabled={!isAdmin} onClick={() => startBalanceEdit(user)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono font-medium text-emerald-600 transition-colors enabled:hover:bg-muted disabled:cursor-default dark:text-emerald-400">
                                                    {user.leaveBalance}
                                                    {isAdmin && <Pencil className="size-3" />}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">{user.dateHired || "-"}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-1">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setViewingUser(user)} aria-label={`View ${user.name}`}>
                                                            <Eye className="size-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="left">View details</TooltipContent>
                                                </Tooltip>
                                                {isAdmin && (
                                                    <>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button type="button" variant="outline" size="icon-sm" onClick={() => setEditingUser(user)} aria-label={`Edit ${user.name}`}>
                                                                    <Pencil className="size-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="left">Edit profile</TooltipContent>
                                                        </Tooltip>
                                                        {!user.isActive && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button type="button" variant="outline" size="icon-sm" disabled={pendingUserId === user.id} onClick={() => handleResendInvite(user)} aria-label={`Resend invite to ${user.name}`}>
                                                                        {pendingUserId === user.id ? <Loader2 className="size-4 animate-spin" /> : <MailPlus className="size-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left">Resend invite</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                        {(user.isActive || user.activatedAt) && (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button type="button" variant={user.isActive ? "destructive-subtle" : "success"} size="icon-sm" disabled={pendingUserId === user.id} onClick={() => handleAccountToggle(user)} aria-label={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.name}`}>
                                                                        {pendingUserId === user.id ? <Loader2 className="size-4 animate-spin" /> : user.isActive ? <UserMinus className="size-4" /> : <UserCheck className="size-4" />}
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left">{user.isActive ? "Deactivate account" : "Reactivate account"}</TooltipContent>
                                                            </Tooltip>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {isAddModalOpen && (
                <Modal title="Add New Employee" onClose={() => setIsAddModalOpen(false)}>
                    <p className="mb-5 text-sm text-muted-foreground">
                        Enter details and migrate their starting PFFD balance from Sprout. A one-time setup link will be generated after creation.
                    </p>
                    <AddEmployeeForm managers={managers} onSuccess={() => setIsAddModalOpen(false)} />
                </Modal>
            )}

            {viewingUser && (
                <Modal title="Employee Details" onClose={() => setViewingUser(null)}>
                    <div className="mb-5 flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                            {getInitials(viewingUser.name)}
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate font-semibold">{viewingUser.name}</h3>
                            <p className="truncate text-sm text-muted-foreground">{viewingUser.email}</p>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Status" value={<StatusBadge user={viewingUser} />} />
                        <Field label="Role" value={<RoleBadge role={viewingUser.role} />} />
                        <Field label="Position" value={viewingUser.position} />
                        <Field label="Department" value={viewingUser.department} />
                        <Field label="Date hired" value={viewingUser.dateHired} />
                        <Field label="Manager" value={viewingUser.managerName} />
                        <Field label="Direct reports" value={viewingUser.directReportCount} />
                        <Field label="Contact number" value={viewingUser.contactNumber} />
                        <Field label="Emergency contact" value={viewingUser.emergencyContact} />
                        <Field label="IC ID" value={viewingUser.icId} />
                        <Field label="PFFD balance" value={viewingUser.leaveBalance} />
                        <Field label="Invited" value={viewingUser.invitedAt} />
                        <Field label="Activated" value={viewingUser.activatedAt} />
                    </div>
                    <div className="mt-3">
                        <Field label="Address" value={viewingUser.address} />
                    </div>
                </Modal>
            )}

            {editingUser && (
                <Modal title="Edit Employee" onClose={() => setEditingUser(null)}>
                    <form onSubmit={submitProfileEdit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextInput label="Full Name" name="name" defaultValue={editingUser.name} required />
                            <TextInput label="Email" name="email" type="email" defaultValue={editingUser.email} required />
                            <SelectInput label="System Role" name="role" defaultValue={editingUser.role} options={[
                                { value: "EMPLOYEE", label: "Employee" },
                                { value: "MANAGER", label: "Manager" },
                                { value: "ADMIN", label: "Admin" },
                            ]} />
                            <TextInput label="Position" name="position" defaultValue={editingUser.position || ""} />
                            <TextInput label="Department" name="department" defaultValue={editingUser.department || ""} />
                            <TextInput label="Date Hired" name="dateHired" type="date" defaultValue={editingUser.dateHiredInput || ""} />
                            <TextInput label="Contact Number" name="contactNumber" defaultValue={editingUser.contactNumber || ""} />
                            <TextInput label="Emergency Contact" name="emergencyContact" defaultValue={editingUser.emergencyContact || ""} />
                            <TextInput label="IC ID" name="icId" defaultValue={editingUser.icId || ""} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Manager</label>
                            <select name="managerId" defaultValue={editingUser.managerId || ""} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50">
                                <option value="">No manager</option>
                                {managers.filter((manager) => manager.id !== editingUser.id).map((manager) => (
                                    <option key={manager.id} value={manager.id}>{manager.name} ({manager.email})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Address</label>
                            <textarea name="address" defaultValue={editingUser.address || ""} rows={3} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50" />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
                            <Button type="submit" disabled={isSavingProfile}>
                                {isSavingProfile && <Loader2 className="size-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function Metric({ label, value, helper, icon: Icon }: { label: string; value: number; helper: string; icon: React.ComponentType<{ className?: string }> }) {
    return (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
                </div>
                <span className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground">
                    <Icon className="size-4" />
                </span>
            </div>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{helper}</p>
        </div>
    );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close modal" />
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold text-foreground">{title}</h2>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
                        <X className="size-4" />
                    </Button>
                </div>
                {children}
            </div>
        </div>
    );
}

function TextInput({ label, name, type = "text", defaultValue, required = false }: { label: string; name: string; type?: string; defaultValue: string; required?: boolean }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
            <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50" />
        </div>
    );
}

function SelectInput({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: { value: string; label: string }[] }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
            <select name={name} defaultValue={defaultValue} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50">
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </div>
    );
}
