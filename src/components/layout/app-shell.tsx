"use client"

import { usePathname } from "next/navigation"

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeIconToggle } from "@/components/theme-toggle"

function getPageCopy(pathname: string) {
  switch (pathname) {
    case "/":
      return {
        title: "Dashboard",
        description: "Your daily snapshot of time logs, leave credits, and activity.",
      }
    case "/timesheets":
      return {
        title: "Timesheets",
        description: "Review your attendance history and total hours worked.",
      }
    case "/schedule":
      return {
        title: "My Weekly Schedule",
        description: "View your assigned working hours for the week.",
      }
    case "/leaves":
      return {
        title: "Pre-Funded Flex Days (PFFD)",
        description: "Request PFFD time off and view your balances.",
      }
    case "/directory":
      return {
        title: "Team Directory",
        description: "Find contact information for everyone at Concertina HR.",
      }
    case "/holidays":
      return {
        title: "Company Holidays",
        description: `View the upcoming official Concertina company holidays for ${new Date().getFullYear()}.`,
      }
    case "/profile":
      return {
        title: "My Profile",
        description: "View and update your personal information.",
      }
    case "/admin/employees":
      return {
        title: "Team Management",
        description: "Add new employees, manage roles, and migrate starting PFFD balances.",
      }
    case "/admin/timesheets":
      return {
        title: "Company Time Logs",
        description: "Advanced Multi-Filter Search",
      }
    case "/admin/leaves":
      return {
        title: "PFFD Approvals",
        description: "Review and manage employee PFFD requests.",
      }
    case "/admin/schedules":
      return {
        title: "Schedule Management",
        description: "Assign and modify weekly work schedules for all team members.",
      }
    case "/admin/holidays":
      return {
        title: "Holiday Management",
        description: "Add and manage official Concertina company holidays.",
      }
    case "/admin/reports":
      return {
        title: "Reporting Dashboard",
        description: "Generate and download CSV reports for payroll and analytics.",
      }
    default:
      return {
        title: "Concertina HR",
        description: "Employee workspace",
      }
  }
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
  const pageCopy = getPageCopy(pathname)

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar user={user} />
      <SidebarInset className="min-h-screen bg-background">
        <header className="hidden h-16 items-center justify-between border-b border-border/70 bg-background/85 px-6 backdrop-blur lg:flex">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="rounded-xl border border-border/70 bg-card shadow-sm hover:bg-accent" />
            <div className="flex min-w-0 flex-col justify-center items-start gap-0.5">
              <p className="flex items-center gap-2 truncate text-[15px] font-semibold leading-5 tracking-tight">
                <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--brand-red)" }} />
                {pageCopy.title}
              </p>
              <p className="truncate text-[13px] leading-5 text-muted-foreground">{pageCopy.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeIconToggle />
          </div>
        </header>

        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur md:px-6 lg:hidden">
          <SidebarTrigger />
          <div className="flex min-w-0 flex-col justify-center items-start gap-0.5">
            <p className="flex items-center gap-2 truncate text-[15px] font-semibold leading-5 tracking-tight">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--brand-red)" }} />
              {pageCopy.title}
            </p>
            <p className="truncate text-[13px] leading-5 text-muted-foreground">{pageCopy.description}</p>
          </div>
          <div className="ml-auto">
            <ThemeIconToggle />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
