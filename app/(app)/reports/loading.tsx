import { ToolbarSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="fade">
      <ToolbarSkeleton />
      <TableSkeleton rows={6} />
    </div>
  );
}
