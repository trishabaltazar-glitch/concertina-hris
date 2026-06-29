import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function RequestsLoading() {
  return <RouteLoadingSkeleton title="Loading requests" cards={3} rows={5} />;
}
