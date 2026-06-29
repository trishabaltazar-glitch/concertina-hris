"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  getNotificationFilterCount,
  matchesNotificationFilter,
  NOTIFICATION_FILTERS,
  type NotificationFilterId,
} from "@/lib/notification-filters";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationsClientPageProps = {
  initialFilter: NotificationFilterId;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
};

function getTypeLabel(type: string) {
  switch (type) {
    case "LEAVE_REQUEST":
      return "Leave request";
    case "LEAVE_APPROVED":
      return "Approved";
    case "LEAVE_REJECTED":
      return "Rejected";
    case "ANNOUNCEMENT":
      return "Announcement";
    case "TIME_ENTRY_REQUEST":
      return "Time entry request";
    case "TIME_ENTRY_APPROVED":
      return "Time entry approved";
    case "TIME_ENTRY_REJECTED":
      return "Time entry rejected";
    case "INFO":
      return "Notice";
    default:
      return "Notice";
  }
}

function getFilterUrl(filterId: NotificationFilterId) {
  return filterId === "all" ? "/notifications" : `/notifications?filter=${filterId}`;
}

export function NotificationsClientPage({
  initialFilter,
  initialNotifications,
  initialUnreadCount,
}: NotificationsClientPageProps) {
  const [activeFilter, setActiveFilter] = React.useState(initialFilter);
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [isMarkingAll, startMarkingAll] = React.useTransition();

  const filteredNotifications = React.useMemo(
    () => notifications.filter((notification) => matchesNotificationFilter(notification, activeFilter)),
    [activeFilter, notifications]
  );

  function updateFilter(filterId: NotificationFilterId) {
    setActiveFilter(filterId);
    window.history.replaceState(null, "", getFilterUrl(filterId));
  }

  function markLocalRead(notificationId: string) {
    const now = new Date().toISOString();
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId && !notification.readAt
          ? { ...notification, readAt: now }
          : notification
      )
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  async function handleMarkRead(notificationId: string) {
    setPendingId(notificationId);
    markLocalRead(notificationId);
    await markNotificationRead(notificationId);
    setPendingId(null);
  }

  function handleMarkAllRead() {
    const now = new Date().toISOString();
    setNotifications((current) => current.map((notification) => ({ ...notification, readAt: notification.readAt || now })));
    setUnreadCount(0);
    startMarkingAll(async () => {
      await markAllNotificationsRead();
    });
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-brand-steel/10 text-brand-steel">
              <Bell className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Leave request updates and important HR activity.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex max-w-full gap-0.5 overflow-x-auto rounded-md bg-muted/60 p-0.5">
            {NOTIFICATION_FILTERS.map((filter) => {
              const count = getNotificationFilterCount(notifications, filter.id);

              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => updateFilter(filter.id)}
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-[11px] font-semibold transition-colors",
                    activeFilter === filter.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.label}
                  <span
                    className={cn(
                      "min-w-4 rounded-full px-1 text-center text-[10px] leading-4",
                      activeFilter === filter.id ? "bg-primary/10 text-primary" : "bg-background/70 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              disabled={isMarkingAll}
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold">No notifications yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Leave request and approval updates will appear here.
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </div>
          <h2 className="mt-4 font-semibold">No notifications in this filter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another tab to see the rest of your notifications.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          <div className="divide-y">
            {filteredNotifications.map((notification) => {
              const content = (
                <div
                  className={cn(
                    "flex gap-4 px-5 py-4 transition-colors hover:bg-accent/70",
                    !notification.readAt && "bg-brand-steel/8"
                  )}
                >
                  <span
                    className={cn(
                      "mt-2 size-2.5 shrink-0 rounded-full",
                      notification.readAt ? "bg-muted" : "bg-brand-red"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {getTypeLabel(notification.type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <h2 className="mt-2 font-semibold text-foreground">{notification.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p>
                  </div>
                </div>
              );

              return (
                <div key={notification.id} className="relative">
                  {notification.href ? (
                    <Link href={notification.href} className="block">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  {!notification.readAt && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-4 top-4 h-8 text-xs"
                      disabled={pendingId === notification.id}
                      onClick={() => handleMarkRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
