type RouteLoadingSkeletonProps = {
  title?: string;
  cards?: number;
  rows?: number;
};

export function RouteLoadingSkeleton({
  title = "Loading",
  cards = 3,
  rows = 4,
}: RouteLoadingSkeletonProps) {
  return (
    <div className="w-full space-y-5">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-muted" />
        <div className="h-7 w-64 max-w-full rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full rounded-full bg-muted/70" />
        <span className="sr-only">{title}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm">
            <div className="h-4 w-28 rounded-full bg-muted" />
            <div className="mt-4 h-8 w-20 rounded-md bg-muted/80" />
            <div className="mt-3 h-3 w-full rounded-full bg-muted/60" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
            <div className="size-8 rounded-md bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-48 max-w-full rounded-full bg-muted" />
              <div className="h-3 w-72 max-w-full rounded-full bg-muted/70" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
