import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="Loading workspace" cards={3} rows={4} />;
}
