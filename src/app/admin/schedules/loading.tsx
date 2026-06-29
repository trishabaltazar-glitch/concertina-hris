import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminSchedulesLoading() {
  return <RouteLoadingSkeleton title="Loading schedules" cards={3} rows={5} />;
}
