import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="flex items-start gap-2.5 bg-card border rounded-lg p-3">
      <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded" />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="ml-auto h-3 w-12" />
      </div>

      {/* Filter bar */}
      <div className="px-3 py-2 border-b bg-muted/10 flex gap-1.5 shrink-0">
        <Skeleton className="h-7 w-36 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-hidden p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function MatchingLoading() {
  return (
    <div className="flex h-full overflow-hidden border-t">
      <ColumnSkeleton />
      <div className="w-px bg-border shrink-0" />
      <ColumnSkeleton />
    </div>
  );
}
