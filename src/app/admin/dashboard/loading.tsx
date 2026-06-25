import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="Loading admin dashboard" cards={4} rows={5} />;
}
