"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, UserRound } from "lucide-react";

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

      <div className={cn("flex items-center justify-between gap-3 px-1 py-1.5", showProfile && "mt-2")}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Notifications
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-bold text-brand-red-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          {unreadCount > 0 && (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-steel hover:bg-accent hover:text-foreground"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleMarkAllRead();
              }}
            >
              <CheckCheck className="size-3.5" />
              Read all
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 flex gap-1 overflow-x-auto px-1 pb-1">
        {NOTIFICATION_FILTERS.map((filter) => {
          const count = getNotificationFilterCount(notifications, filter.id);

          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-semibold transition-colors",
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {filter.label}
              {filter.id !== "all" && count > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] leading-4",
                    activeFilter === filter.id ? "bg-white/20" : "bg-background"
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
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
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

export function NotificationsMenu() {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    getMyNotifications(1)
      .then((result) => {
        if (isMounted) {
          setUnreadCount(result.unreadCount);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUnreadCount(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg border border-border/70 bg-card/80 hover:bg-accent"
          aria-label="Open notifications"
          title="Notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-brand-red px-1 text-[10px] font-bold leading-none text-brand-red-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 rounded-lg p-2" align="end" sideOffset={8}>
        <NotificationsDropdownSection
          onNavigate={() => setIsOpen(false)}
          onUnreadCountChange={setUnreadCount}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
