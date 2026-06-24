import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";

import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getNotificationFilterCount,
  getValidNotificationFilter,
  matchesNotificationFilter,
  NOTIFICATION_FILTERS,
} from "@/lib/notification-filters";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

type NotificationsPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const activeFilter = getValidNotificationFilter(params?.filter);
  const { notifications, unreadCount } = await getMyNotifications(50);
  const filteredNotifications = notifications.filter((notification) =>
    matchesNotificationFilter(notification, activeFilter)
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

        {unreadCount > 0 && (
          <form
            action={async () => {
              "use server";
              await markAllNotificationsRead();
            }}
          >
            <SubmitButton variant="outline" className="gap-2">
              <CheckCheck className="size-4" />
              Mark all read
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border/70 pb-2">
        {NOTIFICATION_FILTERS.map((filter) => {
          const count = getNotificationFilterCount(notifications, filter.id);

          return (
            <Link
              key={filter.id}
              href={filter.id === "all" ? "/notifications" : `/notifications?filter=${filter.id}`}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
                activeFilter === filter.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {filter.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs leading-5",
                  activeFilter === filter.id ? "bg-white/20" : "bg-background"
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
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
                    <form
                      action={async () => {
                        "use server";
                        await markNotificationRead(notification.id);
                      }}
                      className="absolute right-4 top-4"
                    >
                      <SubmitButton variant="ghost" size="sm" className="h-8 text-xs">
                        Mark read
                      </SubmitButton>
                    </form>
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
