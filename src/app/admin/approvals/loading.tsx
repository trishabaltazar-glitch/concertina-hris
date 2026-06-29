import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminApprovalsLoading() {
  return <RouteLoadingSkeleton title="Loading approvals" cards={4} rows={5} />;
}
