"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Maximize2, Minimize2, Send } from "lucide-react";

import { cn } from "@/lib/utils";

type PublishAnnouncementPanelProps = {
  children: ReactNode;
};

export function PublishAnnouncementPanel({ children }: PublishAnnouncementPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const ExpandIcon = isExpanded ? Minimize2 : Maximize2;

  return (
    <section className={cn("rounded-lg border border-border bg-background", isExpanded && "xl:col-span-2")}>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
              <Send className="size-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">Publish announcement</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Active users receive a notification linking to the announcements page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse publish announcement block" : "Expand publish announcement block"}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          <ExpandIcon className="size-3.5" />
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {children}
    </section>
  );
}
