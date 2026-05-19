"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Clock, CalendarHeart, Users, Settings, UserCircle, Calendar, CalendarDays, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { handleSignOut } from "@/app/actions/auth";

const EMP_ROUTES = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Timesheets", href: "/timesheets", icon: Clock },
    { name: "Time Corrections", href: "/time-corrections", icon: Clock },
    { name: "Schedules", href: "/schedule", icon: CalendarDays },
    { name: "PFFD Requests", href: "/leaves", icon: CalendarHeart },
    { name: "OT Requests", href: "/overtime", icon: Clock },
    { name: "My Profile", href: "/profile", icon: UserCircle },
];

const ADMIN_ROUTES = [
    { name: "Admin Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Leave Approvals", href: "/admin/leaves", icon: Users },
    { name: "OT Approvals", href: "/admin/overtime", icon: Clock },
    { name: "Schedules Manager", href: "/admin/schedules", icon: CalendarDays },
    { name: "Holiday Assignments", href: "/admin/holidays", icon: Calendar },
    { name: "Reports Dashboard", href: "/admin/reports", icon: ClipboardList },
    { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar({ user }: { user?: { name?: string | null; email?: string | null; role?: string | null } | null }) {
    const pathname = usePathname();
    const showAdminPanel = user && (user.role === "ADMIN" || user.role === "MANAGER");

    return (
        <aside className="hidden lg:flex w-64 flex-col border-r bg-card/50 backdrop-blur-md px-4 py-6 gap-8 relative z-20 h-screen sticky top-0">
            <div className="flex items-center gap-2 pl-2">
                <div className="size-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <Clock className="size-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl tracking-tight">Concertina HR</span>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
                <div className="text-xs font-semibold text-muted-foreground mb-2 mt-4 px-2 uppercase tracking-wider">
                    Main Menu
                </div>
                {EMP_ROUTES.map((route) => {
                    const isActive = pathname === route.href;
                    return (
                        <Link
                            key={route.name}
                            href={route.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <route.icon className="size-4.5" />
                            {route.name}
                        </Link>
                    );
                })}

                {showAdminPanel && (
                    <>
                        <div className="text-xs font-semibold text-muted-foreground mb-2 mt-8 px-2 uppercase tracking-wider">
                            Administration
                        </div>
                        {ADMIN_ROUTES.map((route) => {
                            const isActive = pathname === route.href;
                            return (
                                <Link
                                    key={route.name}
                                    href={route.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/10"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <route.icon className="size-4.5" />
                                    {route.name}
                                </Link>
                            );
                        })}
                    </>
                )}
            </nav>

            <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <p className="text-sm font-medium text-foreground">{user?.name || "Employee"}</p>
                <p className="text-xs text-muted-foreground mb-3 truncate w-40">{user?.email}</p>
                <form action={handleSignOut}>
                    <button type="submit" className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors">
                        Sign out
                    </button>
                </form>
            </div>
        </aside>
    );
}
