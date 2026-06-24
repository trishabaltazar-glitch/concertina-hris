export const NOTIFICATION_FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "requests", label: "Requests" },
  { id: "updates", label: "Updates" },
  { id: "notices", label: "Notices" },
] as const;

export type NotificationFilterId = (typeof NOTIFICATION_FILTERS)[number]["id"];

type FilterableNotification = {
  type: string;
  readAt: Date | string | null;
};

const REQUEST_TYPES = new Set(["LEAVE_REQUEST", "TIME_ENTRY_REQUEST"]);
const UPDATE_TYPES = new Set([
  "LEAVE_APPROVED",
  "LEAVE_REJECTED",
  "TIME_ENTRY_APPROVED",
  "TIME_ENTRY_REJECTED",
]);
const NOTICE_TYPES = new Set(["ANNOUNCEMENT", "INFO"]);

export function getValidNotificationFilter(value?: string): NotificationFilterId {
  return NOTIFICATION_FILTERS.some((filter) => filter.id === value)
    ? (value as NotificationFilterId)
    : "all";
}

export function matchesNotificationFilter(
  notification: FilterableNotification,
  filterId: NotificationFilterId
) {
  if (filterId === "all") return true;
  if (filterId === "unread") return !notification.readAt;
  if (filterId === "requests") return REQUEST_TYPES.has(notification.type);
  if (filterId === "updates") return UPDATE_TYPES.has(notification.type);
  return NOTICE_TYPES.has(notification.type);
}

export function getNotificationFilterCount(
  notifications: FilterableNotification[],
  filterId: NotificationFilterId
) {
  return notifications.filter((notification) => matchesNotificationFilter(notification, filterId)).length;
}
