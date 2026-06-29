import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminLeavesLoading() {
  return <RouteLoadingSkeleton title="Loading flex day approvals" cards={4} rows={5} />;
}
