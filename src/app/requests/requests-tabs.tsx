"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { CalendarCheck, Clock3, FileText } from "lucide-react";

import { cn } from "@/lib/utils";

const REQUEST_TABS = [
  {
    id: "pffd",
    label: "Flex Day Requests",
    title: "Flex Day Requests",
    description: "Pre-funded flex day filings.",
    icon: FileText,
  },
  {
    id: "ot",
    label: "Overtime Requests",
    title: "Overtime Requests",
    description: "Extra hours with required attachments.",
    icon: Clock3,
  },
  {
    id: "time-corrections",
    label: "Manual Entry Requests",
    title: "Manual Entry Requests",
    description: "Missed or adjusted time logs.",
    icon: CalendarCheck,
  },
] as const;

export type RequestTab = (typeof REQUEST_TABS)[number]["id"];

type RequestsTabsProps = {
  activeTab: RequestTab;
  panels: Record<RequestTab, ReactNode>;
};

export function RequestsTabs({ activeTab, panels }: RequestsTabsProps) {
  const [selectedTab, setSelectedTab] = useState(activeTab);
  const selectedRequest = REQUEST_TABS.find((tab) => tab.id === selectedTab) ?? REQUEST_TABS[0];

  return (
    <div className="w-full space-y-4">
      <section className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-steel">Requests</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{selectedRequest.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{selectedRequest.description}</p>
          </div>

          <div
            role="tablist"
            aria-label="Request type"
            className="grid gap-2 sm:grid-cols-3 lg:w-[640px]"
          >
            {REQUEST_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`request-panel-${tab.id}`}
                  id={`request-tab-${tab.id}`}
                  onClick={() => setSelectedTab(tab.id)}
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
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {REQUEST_TABS.map((tab) => (
        <section
          key={tab.id}
          id={`request-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`request-tab-${tab.id}`}
          hidden={selectedTab !== tab.id}
        >
          {panels[tab.id]}
        </section>
      ))}
    </div>
  );
}
