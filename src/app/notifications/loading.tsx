import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function NotificationsLoading() {
  return <RouteLoadingSkeleton title="Loading notifications" cards={0} rows={5} />;
}
