"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createNotifications } from "@/lib/notifications";
import { sanitizeAnnouncementContent } from "@/lib/announcement-content";

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : "";
}

async function requireAdmin() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user?.id || user.role !== "ADMIN") {
    return null;
  }

  return { id: user.id };
}

export async function createAnnouncement(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: "Only admins can publish announcements." };
  }

  const title = cleanText(formData.get("title"), 140);
  const content = sanitizeAnnouncementContent(formData.get("content"));

  if (!title || !content) {
    return { success: false, error: "Add a title and announcement message." };
  }

  const announcement = await prisma.announcement.create({
    data: {
      title,
      content,
      authorId: admin.id,
    },
  });

  const recipients = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  await createNotifications(
    recipients.map((recipient) => ({
      userId: recipient.id,
      title: "New announcement",
      message: title,
      href: "/announcements",
      type: "ANNOUNCEMENT",
    }))
  );

  await prisma.auditLog.create({
    data: {
      action: "ANNOUNCEMENT_CREATED",
      userId: admin.id,
      details: `Published announcement ${announcement.id}.`,
    },
  });

  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");

  return { success: true };
}

export async function deleteAnnouncement(announcementId: string) {
  const admin = await requireAdmin();
  if (!admin) {
    return { success: false, error: "Only admins can delete announcements." };
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { id: true, title: true },
  });

  if (!announcement) {
    return { success: false, error: "Announcement not found." };
  }

  await prisma.announcement.delete({
    where: { id: announcement.id },
  });

  await prisma.auditLog.create({
    data: {
      action: "ANNOUNCEMENT_DELETED",
      userId: admin.id,
      details: `Deleted announcement ${announcement.id}: ${announcement.title}.`,
    },
  });

  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin/announcements");

  return { success: true };
}
