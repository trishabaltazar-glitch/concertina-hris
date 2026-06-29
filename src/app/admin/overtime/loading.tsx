import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminOvertimeLoading() {
  return <RouteLoadingSkeleton title="Loading overtime approvals" cards={4} rows={5} />;
}
