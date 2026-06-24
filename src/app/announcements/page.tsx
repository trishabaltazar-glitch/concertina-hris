import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { getAnnouncementContentHtml } from "@/lib/announcement-content";

export const dynamic = "force-dynamic";

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  authorName: string;
};

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

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Workspace
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Company updates and HR notices published by administrators.
          </p>
        </div>
        {canManageAnnouncements && (
          <Button asChild size="sm">
            <Link href="/admin/announcements">
              <Plus className="size-4" />
              New announcement
            </Link>
          </Button>
        )}
      </div>

      {databaseError ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-lg bg-destructive/10 text-destructive">
            <Megaphone className="size-5" />
          </div>
          <h2 className="mt-3 font-semibold text-foreground">Announcements unavailable</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            The announcement table is not available yet. Apply the latest database migrations and refresh this page.
          </p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Megaphone className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold text-foreground">No announcements yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New company updates will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">{announcement.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Posted by {announcement.authorName} {formatDistanceToNow(announcement.createdAt, { addSuffix: true })}
                  </p>
                </div>
                <span className="w-fit rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  Notice
                </span>
              </div>
              <div
                className="mt-3 text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:font-semibold [&_h4]:text-foreground [&_hr]:my-4 [&_hr]:border-border [&_img]:my-3 [&_img]:max-h-96 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: getAnnouncementContentHtml(announcement.content) }}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
