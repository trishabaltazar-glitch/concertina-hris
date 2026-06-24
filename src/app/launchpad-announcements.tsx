"use client";

import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type LaunchpadAnnouncement = {
  id: string;
  title: string;
  html: string;
  previewText: string;
  createdAtLabel: string;
};

type LaunchpadAnnouncementsProps = {
  announcements: LaunchpadAnnouncement[];
  unavailable: boolean;
  className?: string;
};

const announcementContentClassName =
  "text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:font-semibold [&_h4]:text-foreground [&_hr]:my-4 [&_hr]:border-border [&_img]:my-3 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5";

export function LaunchpadAnnouncements({ announcements, unavailable, className }: LaunchpadAnnouncementsProps) {
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<LaunchpadAnnouncement | null>(null);

  useEffect(() => {
    if (!selectedAnnouncement) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedAnnouncement(null);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedAnnouncement]);

  return (
    <>
      <section className={cn("flex h-full min-h-0 flex-col rounded-lg border border-border/70 bg-card p-4 shadow-sm", className)}>
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Announcements
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Latest updates
            </h2>
          </div>
          <Link
            href="/announcements"
            className="inline-flex h-9 items-center justify-center rounded-md border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            View all
          </Link>
        </div>

        {unavailable ? (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
            Announcements are unavailable right now.
          </div>
        ) : announcements.length === 0 ? (
          <div className="mt-4 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
            No announcements have been posted yet.
          </div>
        ) : (
          <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {announcements.map((announcement) => (
              <button
                key={announcement.id}
                type="button"
                onClick={() => setSelectedAnnouncement(announcement)}
                className="block w-full rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Megaphone className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {announcement.title}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {announcement.createdAtLabel}
                    </span>
                    <span className="mt-2 block max-h-10 overflow-hidden break-words text-sm leading-5 text-muted-foreground">
                      {announcement.previewText}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedAnnouncement ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-dialog-title"
          onMouseDown={() => setSelectedAnnouncement(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-steel">
                  Announcement
                </p>
                <h2 id="announcement-dialog-title" className="mt-1 text-lg font-semibold text-foreground">
                  {selectedAnnouncement.title}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedAnnouncement.createdAtLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAnnouncement(null)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                aria-label="Close announcement"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto px-4 py-4">
              <div
                className={announcementContentClassName}
                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.html }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
