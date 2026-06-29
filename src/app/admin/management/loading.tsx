import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminManagementLoading() {
  return <RouteLoadingSkeleton title="Loading management" cards={3} rows={5} />;
}
