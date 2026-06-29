import { getMyNotifications } from "@/app/actions/notifications";
import { NotificationsClientPage } from "@/app/notifications/notifications-client-page";
import { getValidNotificationFilter } from "@/lib/notification-filters";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams?: Promise<{
    filter?: string;
  }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams;
  const activeFilter = getValidNotificationFilter(params?.filter);
  const { notifications, unreadCount } = await getMyNotifications(50);

  return (
    <NotificationsClientPage
      initialFilter={activeFilter}
      initialNotifications={notifications.map((notification) => ({
        ...notification,
        readAt: notification.readAt?.toISOString() || null,
        createdAt: notification.createdAt.toISOString(),
      }))}
      initialUnreadCount={unreadCount}
    />
  );
}
