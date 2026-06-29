import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminHolidaysLoading() {
  return <RouteLoadingSkeleton title="Loading holidays" cards={2} rows={5} />;
}
