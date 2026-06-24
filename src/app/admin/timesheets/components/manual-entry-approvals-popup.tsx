"use client";

import { useEffect, useState } from "react";
import { ArrowRight, FileCheck2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ManualEntryRequestPreview = {
  id: string;
  userName: string;
  timeLabel: string;
  status: string;
};

export type ManualEntryApprovalsPopupProps = {
  totalRequests: number;
  pendingRequests: number;
  recentRequests: ManualEntryRequestPreview[];
};

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "APPROVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "REJECTED"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function ManualEntryApprovalsPopup({
  totalRequests,
  pendingRequests,
  recentRequests,
}: ManualEntryApprovalsPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-brand-red hover:text-brand-red-foreground hover:shadow-lg hover:shadow-brand-red/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
      >
        <FileCheck2 className="size-4" />
        <span className="hidden sm:inline">Manual entry</span>
        <span className="inline sm:hidden">Manual</span>
        <span className="rounded-full bg-white/95 px-2 py-0.5 text-xs font-bold text-primary shadow-sm">
          {pendingRequests} pending
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Close manual entry approvals popup"
            onClick={() => setIsOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-entry-approvals-title"
            className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b px-4 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border text-muted-foreground">
                  <FileCheck2 className="size-4" />
                </span>
                <div className="min-w-0">
                  <h2 id="manual-entry-approvals-title" className="text-base font-semibold text-foreground">
                    Manual entry approvals
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Review missed or corrected time requests in Approvals.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Close manual entry approvals popup"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Requests in view</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{totalRequests}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Latest 50 manual entries</p>
                </div>
                <div className="rounded-lg border border-border bg-background/60 px-3 py-3">
                  <p className="text-xs font-medium text-muted-foreground">Pending approvals</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{pendingRequests}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Waiting for review</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Recent requests
                </p>
                {recentRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    No manual entry requests yet.
                  </div>
                ) : (
                  recentRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-border bg-background/60 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{request.userName}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.timeLabel}</p>
                        </div>
                        <StatusBadge status={request.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Button asChild className="w-full">
                <a href="/admin/approvals?tab=manual-entry">
                  Open manual approvals
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
