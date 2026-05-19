"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserRound } from "lucide-react"
import {
  HugeiconsIcon,
} from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Calendar03Icon,
  CalendarCheckIn01Icon,
  CalendarUserIcon,
  DashboardSquare02Icon,
  FileUserIcon,
  Logout02Icon,
  TaskDaily02Icon,
  TimeQuarterPassIcon,
  UserGroupIcon,
  Analytics02Icon,
} from "@hugeicons/core-free-icons"

import { handleSignOut } from "@/app/actions/auth"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

const EMP_ROUTES = [
  { name: "Overview", href: "/", icon: DashboardSquare02Icon },
  { name: "Timesheets", href: "/timesheets", icon: TimeQuarterPassIcon },
  { name: "Schedules", href: "/schedule", icon: CalendarUserIcon },
  { name: "Requests", href: "/requests", icon: TaskDaily02Icon },
]

const ADMIN_ROUTES = [
  { name: "Admin Dashboard", href: "/admin/dashboard", icon: DashboardSquare02Icon },
  { name: "Team Management", href: "/admin/employees", icon: UserGroupIcon },
  { name: "Time Logs", href: "/admin/timesheets", icon: CalendarCheckIn01Icon },
  { name: "Leave Approvals", href: "/admin/leaves", icon: FileUserIcon },
  { name: "OT Approvals", href: "/admin/overtime", icon: TimeQuarterPassIcon },
  { name: "Schedules Manager", href: "/admin/schedules", icon: CalendarUserIcon },
  { name: "Holiday Assignments", href: "/admin/holidays", icon: Calendar03Icon },
  { name: "Reports Dashboard", href: "/admin/reports", icon: Analytics02Icon },
]

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    name?: string | null
    email?: string | null
    role?: string | null
  } | null
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const [isAccountMenuOpen, setIsAccountMenuOpen] = React.useState(false)
  const showAdminPanel = user && (user.role === "ADMIN" || user.role === "MANAGER")
  const signOutFormRef = React.useRef<HTMLFormElement>(null)
  const initial =
    user?.name
      ?.replace(/\([^)]*\)/g, "")
      .trim()
      .match(/[A-Za-z]/)?.[0]
      ?.toUpperCase() || "C"

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70 px-2 py-2.5 group-data-[collapsible=icon]:px-1.5">
        <Link
          href="/"
          className="flex items-center justify-center rounded-md px-1 py-1 transition-colors dark:bg-white/95 dark:shadow-sm group-data-[collapsible=icon]:px-0.5"
        >
          <Image
            src="/assets/egs-logo.avif"
            alt="Enterprise Growth Systems"
            width={140}
            height={40}
            priority
            className="h-auto w-full max-w-[88px] object-contain group-data-[collapsible=icon]:max-w-5"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-3 px-2 py-3 group-data-[collapsible=icon]:px-1.5">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="h-7 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {EMP_ROUTES.map((route) => {
                const isActive = pathname === route.href || (route.href === "/requests" && ["/leaves", "/overtime", "/time-corrections"].includes(pathname))

                return (
                  <SidebarMenuItem key={route.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={route.name}
                      className={cn(
                        "h-9 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/80 transition-all",
                        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-md data-[active=true]:shadow-black/10"
                      )}
                    >
                      <Link
                        href={route.href}
                        prefetch={route.href !== "/requests"}
                        className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                      >
                        <HugeiconsIcon
                          icon={route.icon}
                          size={19}
                          strokeWidth={1.8}
                          className="shrink-0 group-data-[collapsible=icon]:scale-125"
                        />
                        <span>{route.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showAdminPanel && (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="h-7 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_ROUTES.map((route) => {
                  const isActive = pathname === route.href

                  return (
                    <SidebarMenuItem key={route.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={route.name}
                      className={cn(
                        "h-9 rounded-lg px-2.5 text-[13px] text-sidebar-foreground/80 transition-all",
                        "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          "data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground data-[active=true]:shadow-md data-[active=true]:shadow-black/10"
                        )}
                      >
                        <Link
                          href={route.href}
                          prefetch
                          className="flex w-full items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                        >
                          <HugeiconsIcon
                            icon={route.icon}
                            size={19}
                            strokeWidth={1.8}
                            className="shrink-0 group-data-[collapsible=icon]:scale-125"
                          />
                          <span>{route.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-2 group-data-[collapsible=icon]:px-1.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Account"
                  className={cn(
                    "h-11 rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 px-2.5 shadow-sm transition-all",
                    "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                    "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:px-0"
                  )}
                >
                  <Avatar className="h-8 w-8 rounded-lg border border-sidebar-border/70 bg-sidebar-primary/12 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                    <AvatarFallback className="rounded-lg bg-transparent text-xs font-semibold text-sidebar-foreground group-data-[collapsible=icon]:text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-sidebar-foreground" title={user?.name || "Employee"}>
                      {user?.name || "Employee"}
                    </span>
                    <span className="truncate text-[11px] text-sidebar-foreground/60" title={user?.email || "No email"}>
                      {user?.email || "No email"}
                    </span>
                  </div>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={16}
                    strokeWidth={1.8}
                    className="ml-auto text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden"
                  />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-64 rounded-lg p-2"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-left">
                    <Avatar className="h-11 w-11 rounded-2xl border border-border/70 bg-muted">
                      <AvatarFallback className="rounded-2xl bg-transparent text-sm font-semibold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || "Employee"}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || "No email"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild onSelect={() => setIsAccountMenuOpen(false)}>
                  <Link href="/profile">
                    <UserRound className="size-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form ref={signOutFormRef} action={handleSignOut}>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(event) => {
                      event.preventDefault()
                      signOutFormRef.current?.requestSubmit()
                    }}
                  >
                    <HugeiconsIcon icon={Logout02Icon} size={18} strokeWidth={1.8} />
                    Log out
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
