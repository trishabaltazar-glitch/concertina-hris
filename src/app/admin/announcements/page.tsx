import { format } from "date-fns";
import { Megaphone, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createAnnouncement, deleteAnnouncement } from "@/app/actions/announcements";
import prisma from "@/lib/prisma";
import { SubmitButton } from "@/components/ui/submit-button";
import { getAnnouncementContentHtml } from "@/lib/announcement-content";
import { AnnouncementEditor } from "./announcement-editor";
import { PublishAnnouncementPanel } from "./publish-announcement-panel";

export const dynamic = "force-dynamic";

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  authorName: string;
};

export default async function AdminAnnouncementsPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id || user.role !== "ADMIN") {
    redirect("/");
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
      LIMIT 100
    `;
  } catch (error) {
    console.error("Failed to load admin announcements:", error);
    databaseError = true;
  }

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Administration
          </span>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Announcements</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Publish company notices to the employee workspace and notification bell.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <p className="text-xs text-muted-foreground">Published</p>
          <p className="mt-1 font-semibold text-foreground">{announcements.length}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
        <PublishAnnouncementPanel>
          <form
            action={async (formData) => {
              "use server";
              await createAnnouncement(formData);
            }}
            className="space-y-4 px-4 py-4"
          >
            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Title
              <input
                type="text"
                name="title"
                required
                maxLength={140}
                placeholder="Example: Payroll cutoff reminder"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <label className="block space-y-1.5 text-sm font-medium text-foreground">
              Message
              <AnnouncementEditor />
            </label>

            <SubmitButton size="sm" className="w-full">
              Publish announcement
            </SubmitButton>
          </form>
        </PublishAnnouncementPanel>

        <section className="rounded-lg border border-border bg-background">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border text-muted-foreground">
                  <Megaphone className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold text-foreground">Published notices</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest announcements visible to employees.
              </p>
            </div>
            <span className="w-fit rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {announcements.length} shown
            </span>
          </div>

          {databaseError ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              Announcements could not be loaded. Apply the latest database migrations and refresh this page.
            </div>
          ) : announcements.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No announcements have been published yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {announcements.map((announcement) => (
                <article key={announcement.id} className="px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{announcement.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(announcement.createdAt, "MMM d, yyyy h:mm a")} by {announcement.authorName}
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deleteAnnouncement(announcement.id);
                      }}
                    >
                      <SubmitButton variant="destructive-outline" size="sm" className="h-8 w-auto text-xs">
                        <Trash2 className="size-3.5" />
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                  <div
                    className="mt-3 max-h-32 overflow-hidden text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-semibold [&_h3]:text-foreground [&_h4]:font-semibold [&_h4]:text-foreground [&_hr]:my-4 [&_hr]:border-border [&_img]:my-3 [&_img]:max-h-72 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-border [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: getAnnouncementContentHtml(announcement.content) }}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
