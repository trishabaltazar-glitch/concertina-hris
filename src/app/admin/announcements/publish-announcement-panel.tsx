"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Maximize2, Send, X } from "lucide-react";

type PublishAnnouncementPanelProps = {
  children: ReactNode;
};

export function PublishAnnouncementPanel({ children }: PublishAnnouncementPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    }

    const originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isExpanded]);

  return (
    <section className="rounded-lg border border-border bg-background">
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
          onClick={() => setIsExpanded(true)}
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          aria-expanded={isExpanded}
          aria-haspopup="dialog"
          aria-label="Expand publish announcement block"
          title="Expand"
        >
          <Maximize2 className="size-3.5" />
          Expand
        </button>
      </div>

      {children}

      {isExpanded ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close publish announcement popup"
            onClick={() => setIsExpanded(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-announcement-dialog-title"
            className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                    <Send className="size-3.5" />
                  </span>
                  <h2 id="publish-announcement-dialog-title" className="text-sm font-semibold text-foreground">
                    Publish announcement
                  </h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Compose with more room, then publish to employee notifications.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Close publish announcement popup"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto">{children}</div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
