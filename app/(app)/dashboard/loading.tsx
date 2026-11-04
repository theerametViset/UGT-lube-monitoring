import { KpiRowSkeleton, ChartRowSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="fade">
      <KpiRowSkeleton count={4} />
      <ChartRowSkeleton count={2} />
      <TableSkeleton rows={8} />
    </div>
  );
}
