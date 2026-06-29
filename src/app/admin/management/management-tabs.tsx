import type { ReactNode } from "react";
import { CalendarDays, CalendarPlus, Users } from "lucide-react";

import { IntentPrefetchTabLink } from "@/components/intent-prefetch-tab-link";
import { cn } from "@/lib/utils";

const MANAGEMENT_TABS = [
  {
    id: "team",
    label: "Team Directory",
    title: "Team Directory",
    description: "Profiles, roles, reporting lines, and balances.",
    icon: Users,
  },
  {
    id: "schedules",
    label: "Work Schedules",
    title: "Work Schedules",
    description: "Weekly schedules and one-day special shifts.",
    icon: CalendarDays,
  },
  {
    id: "holidays",
    label: "Holiday Assignments",
    title: "Holiday Assignments",
    description: "Employee-specific holiday coverage.",
    icon: CalendarPlus,
  },
] as const;

export type ManagementTab = (typeof MANAGEMENT_TABS)[number]["id"];

type ManagementTabsProps = {
  activeTab: ManagementTab;
  panel: ReactNode;
};

export function ManagementTabs({ activeTab, panel }: ManagementTabsProps) {
  const selectedTool = MANAGEMENT_TABS.find((tab) => tab.id === activeTab) ?? MANAGEMENT_TABS[0];

  return (
    <div className="w-full space-y-4">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-steel">Management</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{selectedTool.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{selectedTool.description}</p>
          </div>

          <div role="tablist" aria-label="Management tool" className="grid gap-2 sm:grid-cols-3 lg:w-[640px]">
            {MANAGEMENT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <IntentPrefetchTabLink
                  key={tab.id}
                  href={`/admin/management?tab=${tab.id}`}
                  active={isActive}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`management-panel-${tab.id}`}
                  id={`management-tab-${tab.id}`}
                  className={cn(
                    "group relative flex h-10 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isActive
                        ? "border-primary-foreground/25 bg-primary-foreground/12 text-primary-foreground"
                        : "border-border bg-card text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 truncate text-xs font-semibold">{tab.label}</span>
                </IntentPrefetchTabLink>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id={`management-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`management-tab-${activeTab}`}
      >
        {panel}
      </section>
    </div>
  );
}
