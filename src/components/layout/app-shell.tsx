"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeIconToggle } from "@/components/theme-toggle"
import { NotificationsMenu } from "@/components/notifications-dropdown-section"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

function getPageLabel(pathname: string) {
  switch (pathname) {
    case "/":
      return "Launchpad"
    case "/timesheets":
      return "Timesheets"
    case "/requests":
      return "Requests"
    case "/announcements":
      return "Announcements"
    case "/time-corrections":
      return "Manual Entry"
    case "/schedule":
      return "My Weekly Schedule"
    case "/leaves":
      return "Pre-Funded Flex Days"
    case "/overtime":
      return "Overtime Requests"
    case "/profile":
      return "My Profile"
    case "/admin/management":
      return "Management"
    case "/admin/approvals":
      return "Approvals"
    case "/admin/employees":
      return "Team Management"
    case "/admin/dashboard":
      return "Dashboard"
    case "/admin/timesheets":
      return "Company Time Logs"
    case "/admin/leaves":
      return "PFFD Approvals"
    case "/admin/overtime":
      return "OT Approvals"
    case "/admin/schedules":
      return "Schedule Management"
    case "/admin/holidays":
      return "Holiday Assignments"
    case "/admin/reports":
      return "Reports"
    case "/admin/announcements":
      return "Announcements"
    case "/notifications":
      return "Notifications"
    default:
      return "Concertina HR"
  }
}

function AppBreadcrumbs({ pathname }: { pathname: string }) {
  const currentLabel = getPageLabel(pathname)
  const isHome = pathname === "/"
  const isAdmin = pathname.startsWith("/admin")
  const sectionLabel = isAdmin ? "Admin" : "Workspace"

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {isHome ? (
            <span className="text-muted-foreground">Workspace</span>
          ) : isAdmin ? (
            <span className="text-muted-foreground">Admin</span>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/">Workspace</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {isHome ? (
          <BreadcrumbItem>
            <BreadcrumbPage>Launchpad</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <BreadcrumbItem>
            <BreadcrumbPage>{currentLabel === "Concertina HR" ? sectionLabel : currentLabel}</BreadcrumbPage>
          </BreadcrumbItem>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function AppShell({
  user,
  children,
}: {
  user?: {
    name?: string | null
    email?: string | null
    role?: string | null
  } | null
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-screen min-w-0 overflow-x-hidden bg-background">
        <header className="hidden h-16 items-center justify-between border-b border-border/70 bg-background/85 px-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="rounded-xl border border-border/70 bg-card shadow-sm hover:bg-accent" />
            <AppBreadcrumbs pathname={pathname} />
          </div>
          <div className="flex items-center gap-2">
            <ThemeIconToggle />
            <NotificationsMenu />
          </div>
        </header>

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-6 lg:hidden">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <AppBreadcrumbs pathname={pathname} />
          </div>
          <div className="ml-auto">
            <ThemeIconToggle />
          </div>
          <NotificationsMenu />
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
