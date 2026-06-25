"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export type UserNotification = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  type: string;
  readAt: Date | null;
  createdAt: Date;
};

export async function getMyNotifications(limit = 8) {
  const session = await auth();
  if (!session?.user?.id) {
    return { notifications: [] as UserNotification[], unreadCount: 0 };
  }

  try {
    const notifications = await prisma.$queryRaw<UserNotification[]>`
      SELECT "id", "title", "message", "href", "type", "readAt", "createdAt"
      FROM "Notification"
      WHERE "userId" = ${session.user.id}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;

    const unreadRows = await prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int as count
      FROM "Notification"
      WHERE "userId" = ${session.user.id} AND "readAt" IS NULL
    `;

    return {
      notifications,
      unreadCount: unreadRows[0]?.count || 0,
    };
  } catch {
    return { notifications: [] as UserNotification[], unreadCount: 0 };
  }
}

export async function getMyUnreadNotificationCount() {
  const session = await auth();
  if (!session?.user?.id) return 0;

  try {
    return await prisma.notification.count({
      where: {
        userId: session.user.id,
        readAt: null,
      },
    });
  } catch {
    return 0;
  }
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "readAt" = COALESCE("readAt", ${new Date()})
      WHERE "id" = ${notificationId} AND "userId" = ${session.user.id}
    `;
  } catch {
    return { success: false };
  }

  revalidatePath("/");
  return { success: true };
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await prisma.$executeRaw`
      UPDATE "Notification"
      SET "readAt" = COALESCE("readAt", ${new Date()})
      WHERE "userId" = ${session.user.id} AND "readAt" IS NULL
    `;
  } catch {
    return { success: false };
  }

  revalidatePath("/");
  return { success: true };
}
