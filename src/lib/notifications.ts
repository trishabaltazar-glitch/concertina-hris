import { randomUUID } from "crypto";

import prisma from "@/lib/prisma";

export type NotificationType =
  | "INFO"
  | "LEAVE_REQUEST"
  | "LEAVE_APPROVED"
  | "LEAVE_REJECTED"
  | "TIME_ENTRY_REQUEST"
  | "TIME_ENTRY_APPROVED"
  | "TIME_ENTRY_REJECTED";

type CreateNotificationInput = {
  userId: string;
  title: string;
  message: string;
  href?: string;
  type?: NotificationType;
};

export async function createNotification({
  userId,
  title,
  message,
  href,
  type = "INFO",
}: CreateNotificationInput) {
  await prisma.$executeRaw`
    INSERT INTO "Notification" ("id", "userId", "title", "message", "href", "type", "createdAt")
    VALUES (${randomUUID()}, ${userId}, ${title}, ${message}, ${href || null}, ${type}, ${new Date()})
  `;
}

export async function createNotifications(notifications: CreateNotificationInput[]) {
  if (notifications.length === 0) return;

  await prisma.$transaction(
    notifications.map((notification) =>
      prisma.$executeRaw`
        INSERT INTO "Notification" ("id", "userId", "title", "message", "href", "type", "createdAt")
        VALUES (
          ${randomUUID()},
          ${notification.userId},
          ${notification.title},
          ${notification.message},
          ${notification.href || null},
          ${notification.type || "INFO"},
          ${new Date()}
        )
      `
    )
  );
}
