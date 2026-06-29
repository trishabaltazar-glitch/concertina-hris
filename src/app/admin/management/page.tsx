import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { type ManagementTab, ManagementTabs } from "@/app/admin/management/management-tabs";
import { HolidayAssignmentsPanel, SchedulesManagerPanel, TeamManagementPanel } from "@/app/admin/management/panels";

export const dynamic = "force-dynamic";

const MANAGEMENT_TABS = ["team", "schedules", "holidays"] as const;

function getActiveTab(tab?: string): ManagementTab {
  return MANAGEMENT_TABS.includes(tab as ManagementTab) ? (tab as ManagementTab) : "team";
}

function ManagementPanelError({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <h2 className="mt-3 font-semibold text-foreground">{label} could not be loaded</h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        The database connection is temporarily unavailable. Refresh the page after the connection recovers.
      </p>
    </div>
  );
}

async function safePanel(label: string, load: () => Promise<ReactNode>) {
  try {
    return await load();
  } catch (error) {
    console.error(`Failed to load ${label} management panel:`, error);
    return <ManagementPanelError label={label} />;
  }
}

export default async function AdminManagementPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    redirect("/");
  }
  const managementUser = { id: user.id, role: user.role };

  const params = await searchParams;
  const activeTab = getActiveTab(params?.tab);
  const activePanel =
    activeTab === "schedules"
      ? await safePanel("Schedules manager", () => SchedulesManagerPanel({ user: managementUser }))
      : activeTab === "holidays"
        ? await safePanel("Holiday assignments", () => HolidayAssignmentsPanel({ user: managementUser }))
        : await safePanel("Team management", () => TeamManagementPanel({ user: managementUser }));

  return (
    <ManagementTabs
      activeTab={activeTab}
      panel={activePanel}
    />
  );
}
