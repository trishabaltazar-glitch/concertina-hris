import type { ReactNode } from "react";
import { Clock3, FileCheck2, FileText } from "lucide-react";

import { IntentPrefetchTabLink } from "@/components/intent-prefetch-tab-link";
import { cn } from "@/lib/utils";

const APPROVAL_TABS = [
  {
    id: "pffd",
    label: "Flex Day Approvals",
    title: "Flex Day Approvals",
    description: "Review pre-funded flex day filings.",
    icon: FileText,
  },
  {
    id: "ot",
    label: "Overtime Approvals",
    title: "Overtime Approvals",
    description: "Review overtime filings and attachments.",
    icon: Clock3,
  },
  {
    id: "manual-entry",
    label: "Manual Entry Approvals",
    title: "Manual Entry Approvals",
    description: "Approve missed or corrected time logs.",
    icon: FileCheck2,
  },
] as const;

export type ApprovalTab = (typeof APPROVAL_TABS)[number]["id"];

type ApprovalsTabsProps = {
  activeTab: ApprovalTab;
  panel: ReactNode;
};

export function ApprovalsTabs({ activeTab, panel }: ApprovalsTabsProps) {
  const selectedApproval = APPROVAL_TABS.find((tab) => tab.id === activeTab) ?? APPROVAL_TABS[0];

  return (
    <div className="w-full space-y-4">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-steel">Approvals</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{selectedApproval.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{selectedApproval.description}</p>
          </div>

          <div role="tablist" aria-label="Approval type" className="grid gap-2 sm:grid-cols-3 lg:w-[640px]">
            {APPROVAL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <IntentPrefetchTabLink
                  key={tab.id}
                  href={`/admin/approvals?tab=${tab.id}`}
                  active={isActive}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`approval-panel-${tab.id}`}
                  id={`approval-tab-${tab.id}`}
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
        id={`approval-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`approval-tab-${activeTab}`}
      >
        {panel}
      </section>
    </div>
  );
}
