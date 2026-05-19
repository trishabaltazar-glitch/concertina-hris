"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Clock3, FileCheck2, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

const APPROVAL_TABS = [
  {
    id: "pffd",
    label: "PFFD",
    title: "PFFD Approvals",
    description: "Review pre-funded flex day filings",
    icon: FileText,
  },
  {
    id: "ot",
    label: "OT",
    title: "OT Approvals",
    description: "Review overtime filings and attachments",
    icon: Clock3,
  },
  {
    id: "manual-entry",
    label: "Manual Entry",
    title: "Manual Entry Approvals",
    description: "Approve missed or corrected time logs",
    icon: FileCheck2,
  },
] as const;

export type ApprovalTab = (typeof APPROVAL_TABS)[number]["id"];

type ApprovalsTabsProps = {
  activeTab: ApprovalTab;
  panels: Record<ApprovalTab, ReactNode>;
};

export function ApprovalsTabs({ activeTab, panels }: ApprovalsTabsProps) {
  const [selectedTab, setSelectedTab] = useState(activeTab);
  const selectedApproval = APPROVAL_TABS.find((tab) => tab.id === selectedTab) ?? APPROVAL_TABS[0];

  return (
    <div className="w-full space-y-4">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-steel">Approvals</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{selectedApproval.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{selectedApproval.description}</p>
          </div>

          <div role="tablist" aria-label="Approval type" className="grid gap-2 sm:grid-cols-3 lg:w-[680px]">
            {APPROVAL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`approval-panel-${tab.id}`}
                  id={`approval-tab-${tab.id}`}
                  onClick={() => setSelectedTab(tab.id)}
                  className={cn(
                    "group relative flex h-11 items-center gap-2.5 rounded-lg border px-3 text-left transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                      isActive
                        ? "border-primary-foreground/25 bg-primary-foreground/12 text-primary-foreground"
                        : "border-border bg-card text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {APPROVAL_TABS.map((tab) => (
        <section
          key={tab.id}
          id={`approval-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`approval-tab-${tab.id}`}
          hidden={selectedTab !== tab.id}
        >
          {panels[tab.id]}
        </section>
      ))}
    </div>
  );
}
