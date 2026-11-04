function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-black/[0.06] ${className}`} />;
}

export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} className="h-[76px]" />
      ))}
    </div>
  );
}

export function ChartRowSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} className="h-[220px]" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg2 p-0">
      <Block className="h-9 rounded-none rounded-t-2xl" />
      <div className="space-y-2 p-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Block key={i} className="h-8" />
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Block key={i} className="h-[120px]" />
      ))}
    </div>
  );
}

export function ToolbarSkeleton() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Block className="h-8 w-[200px]" />
      <Block className="h-8 w-[110px]" />
      <Block className="h-8 w-[90px]" />
    </div>
  );
}
