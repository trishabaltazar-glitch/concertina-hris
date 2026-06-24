"use client";

import { BellRing, Clock3, Megaphone } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type AnnouncementBoardItem = {
  id: string;
  title: string;
  html: string;
  previewText: string;
  authorName: string;
  dateLabel: string;
  relativeDateLabel: string;
};

type AnnouncementsBoardProps = {
  announcements: AnnouncementBoardItem[];
};

const announcementContentClassName =
  "text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:rounded-md [&_blockquote]:border-l-2 [&_blockquote]:border-brand-red/50 [&_blockquote]:bg-muted/35 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:mb-1.5 [&_h4]:mt-3 [&_h4]:font-semibold [&_h4]:text-foreground [&_hr]:my-4 [&_hr]:border-border [&_img]:my-3 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5";

export function AnnouncementsBoard({ announcements }: AnnouncementsBoardProps) {
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState(announcements[0]?.id ?? "");
  const selectedAnnouncement = useMemo(
    () => announcements.find((announcement) => announcement.id === selectedAnnouncementId) ?? announcements[0],
    [announcements, selectedAnnouncementId]
  );

  if (!selectedAnnouncement) {
    return null;
  }

  return (
    <section className="grid overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm lg:min-h-[620px] lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="border-b border-border/70 bg-muted/20 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">Notice Board</p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">{announcements.length} published</h2>
          </div>
          <span className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-background text-brand-red">
            <BellRing className="size-4" />
          </span>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-2 lg:max-h-[calc(100vh-290px)]">
          {announcements.map((announcement) => {
            const isSelected = announcement.id === selectedAnnouncement.id;

            return (
              <button
                key={announcement.id}
                type="button"
                onClick={() => setSelectedAnnouncementId(announcement.id)}
                className={cn(
                  "block w-full rounded-md border px-3 py-3 text-left transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  isSelected
                    ? "border-brand-red/35 bg-background shadow-sm"
                    : "border-transparent bg-transparent hover:border-border/70 hover:bg-background/70"
                )}
                aria-current={isSelected ? "true" : undefined}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {announcement.title}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      {announcement.relativeDateLabel}
                    </span>
                  </span>
                  {isSelected && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-red" />}
                </span>
                <span className="mt-2 block max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                  {announcement.previewText}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <article className="min-w-0 bg-card">
        <div className="border-b border-border/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">Announcement</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {selectedAnnouncement.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Posted by {selectedAnnouncement.authorName}</span>
                <span className="size-1 rounded-full bg-border" />
                <span>{selectedAnnouncement.dateLabel}</span>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              <Megaphone className="size-3.5" />
              {selectedAnnouncement.relativeDateLabel}
            </span>
          </div>
        </div>

        <div className="max-h-none overflow-y-auto px-4 py-4 sm:px-5 lg:max-h-[calc(100vh-260px)]">
          <div
            className={announcementContentClassName}
            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.html }}
          />
        </div>
      </article>
    </section>
  );
}
