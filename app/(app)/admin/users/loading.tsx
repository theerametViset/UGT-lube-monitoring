import { TableSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="fade">
      <TableSkeleton rows={8} />
    </div>
  );
}
