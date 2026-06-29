"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CheckCheck, UserRound } from "lucide-react";

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/app/actions/notifications";
import {
  getNotificationFilterCount,
  matchesNotificationFilter,
  NOTIFICATION_FILTERS,
  type NotificationFilterId,
} from "@/lib/notification-filters";
import { cn } from "@/lib/utils";

type NotificationsDropdownSectionProps = {
  onNavigate?: () => void;
  onUnreadCountChange?: (count: number) => void;
  showProfile?: boolean;
};

function formatRelativeTime(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationsDropdownSection({
  onNavigate,
  onUnreadCountChange,
  showProfile = false,
}: NotificationsDropdownSectionProps) {
  const [notifications, setNotifications] = React.useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState<NotificationFilterId>("all");

  const loadNotifications = React.useCallback(async () => {
    try {
      const result = await getMyNotifications(12);
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      onUnreadCountChange?.(result.unreadCount);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
      onUnreadCountChange?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadCountChange]);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await loadNotifications();
  };

  const handleOpenNotification = async (notification: UserNotification) => {
    if (!notification.readAt) {
      await markNotificationRead(notification.id);
      await loadNotifications();
    }
  };

  const filteredNotifications = notifications.filter((notification) =>
    matchesNotificationFilter(notification, activeFilter)
  );

  return (
    <div className="px-1 py-1">
      {showProfile && (
        <div className="space-y-1">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
            onClick={onNavigate}
          >
            <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-foreground">My Profile</span>
            </span>
          </Link>
        </div>
      )}

      <div className={cn("flex items-center justify-between gap-2 px-1 py-1", showProfile && "mt-2")}>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Notifications
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-bold leading-4 text-brand-red-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-brand-steel hover:bg-accent hover:text-foreground"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMarkAllRead();
              }}
            >
              <CheckCheck className="size-3" />
              Read
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted/60 p-0.5">
        {NOTIFICATION_FILTERS.map((filter) => {
          const count = getNotificationFilterCount(notifications, filter.id);

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold transition-colors",
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              )}
            >
              {filter.label}
              {filter.id !== "all" && count > 0 ? (
                <span
                  className={cn(
                    "min-w-4 rounded-full px-1 text-center text-[10px] leading-4",
                    activeFilter === filter.id ? "bg-white/20 text-primary-foreground" : "bg-background/70"
                  )}
                >
                  {count > 9 ? "9+" : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2 px-1 py-2">
            <div className="h-3 w-32 rounded-full bg-muted" />
            <div className="h-3 w-44 rounded-full bg-muted/80" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No notifications yet.
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No notifications in this filter.
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const content = (
              <div
                className={cn(
                  "rounded-md px-2 py-2 text-left transition-colors hover:bg-accent",
                  notification.readAt
                    ? "bg-transparent"
                    : "bg-brand-steel/10"
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      notification.readAt ? "bg-muted" : "bg-brand-red"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {formatRelativeTime(new Date(notification.createdAt))}
                    </p>
                  </div>
                </div>
              </div>
            );

            return notification.href ? (
              <Link
                key={notification.id}
                href={notification.href}
                className="block"
                onClick={() => {
                  handleOpenNotification(notification);
                  onNavigate?.();
                }}
              >
                {content}
              </Link>
            ) : (
              <button
                key={notification.id}
                type="button"
                className="block w-full"
                onClick={() => handleOpenNotification(notification)}
              >
                {content}
              </button>
            );
          })
        )}
      </div>

      <Link
        href="/notifications"
        className="mt-2 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-brand-steel transition-colors hover:bg-accent hover:text-foreground"
        onClick={onNavigate}
      >
        <Bell className="size-3.5" />
        View all notifications
      </Link>
    </div>
  );
}
