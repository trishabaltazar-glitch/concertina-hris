import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { getAnnouncementContentHtml } from "@/lib/announcement-content";
import { AnnouncementsBoard, type AnnouncementBoardItem } from "./announcements-board";

export const dynamic = "force-dynamic";

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  authorName: string;
};

function getPreviewText(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function AnnouncementsPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id) {
    redirect("/login");
  }

  let announcements: AnnouncementRow[] = [];
  let databaseError = false;

  try {
    announcements = await prisma.$queryRaw<AnnouncementRow[]>`
      SELECT
        a."id",
        a."title",
        a."content",
        a."createdAt",
        u."name" as "authorName"
      FROM "Announcement" a
      INNER JOIN "User" u ON u."id" = a."authorId"
      ORDER BY a."createdAt" DESC
      LIMIT 50
    `;
  } catch (error) {
    console.error("Failed to load announcements:", error);
    databaseError = true;
  }

  const canManageAnnouncements = user.role === "ADMIN";
  const boardAnnouncements: AnnouncementBoardItem[] = announcements.map((announcement) => {
    const html = getAnnouncementContentHtml(announcement.content);

    return {
      id: announcement.id,
      title: announcement.title,
      html,
      previewText: getPreviewText(html) || "Open announcement",
      authorName: announcement.authorName,
      dateLabel: format(announcement.createdAt, "MMM d, yyyy h:mm a"),
      relativeDateLabel: formatDistanceToNow(announcement.createdAt, { addSuffix: true }),
    };
  });

  return (
    <div className="w-full space-y-5">
      <section>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-brand-red">
                <Megaphone className="size-4" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-steel">
                  Workspace
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
              </div>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Company updates, HR notices, and operational reminders from the admin team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium text-muted-foreground">
              {announcements.length} published
            </span>
            {canManageAnnouncements && (
              <Button
                asChild
                size="sm"
                className="h-9 border-brand-red bg-brand-red px-3 text-brand-red-foreground shadow-md shadow-brand-red/20 hover:bg-brand-red/90 hover:text-brand-red-foreground hover:shadow-lg hover:shadow-brand-red/25 focus-visible:ring-brand-red/35"
              >
                <Link href="/admin/announcements">
                  <Plus className="size-4" />
                  New announcement
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {databaseError ? (
        <section className="rounded-lg border border-border/70 bg-card px-6 py-14 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Megaphone className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">Announcements unavailable</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            The announcement table is not available yet. Apply the latest database migrations and refresh this page.
          </p>
        </section>
      ) : boardAnnouncements.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border/80 bg-card px-6 py-16 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Megaphone className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">No announcements yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-6 text-muted-foreground">
            New company updates will appear here once an administrator publishes them.
          </p>
          {canManageAnnouncements && (
            <Button asChild size="sm" className="mt-5">
              <Link href="/admin/announcements">
                <Plus className="size-4" />
                Publish first announcement
              </Link>
            </Button>
          )}
        </section>
      ) : (
        <AnnouncementsBoard announcements={boardAnnouncements} />
      )}
    </div>
  );
}
