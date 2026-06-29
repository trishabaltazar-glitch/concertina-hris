import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminReportsLoading() {
  return <RouteLoadingSkeleton title="Loading reports" cards={3} rows={4} />;
}
