import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function AdminEmployeesLoading() {
  return <RouteLoadingSkeleton title="Loading employees" cards={3} rows={6} />;
}
