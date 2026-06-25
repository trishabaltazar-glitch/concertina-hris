import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function KnowledgeBaseLoading() {
  return <RouteLoadingSkeleton title="Loading knowledge base" cards={3} rows={3} />;
}
