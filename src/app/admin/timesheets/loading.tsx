import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton title="Loading company time logs" cards={4} rows={6} />;
}
