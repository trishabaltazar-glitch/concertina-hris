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
      return "Home"
    case "/timesheets":
      return "Timesheets"
    case "/schedule":
      return "My Weekly Schedule"
    case "/leaves":
      return "Pre-Funded Flex Days"
    case "/directory":
      return "Team Directory"
    case "/holidays":
      return "Company Holidays"
    case "/profile":
      return "My Profile"
    case "/admin/employees":
      return "Team Management"
    case "/admin/timesheets":
      return "Company Time Logs"
    case "/admin/leaves":
      return "PFFD Approvals"
    case "/admin/schedules":
      return "Schedule Management"
    case "/admin/holidays":
      return "Holiday Management"
    case "/admin/reports":
      return "Reporting Dashboard"
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

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {isHome ? (
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {isAdmin && (
              <>
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <span className="text-muted-foreground">Administration</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:inline-flex" />
              </>
            )}
            <BreadcrumbItem>
              <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
            </BreadcrumbItem>
          </>
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
      <SidebarInset className="min-h-screen bg-background">
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

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
