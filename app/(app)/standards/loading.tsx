import { ToolbarSkeleton, CardGridSkeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="fade">
      <ToolbarSkeleton />
      <CardGridSkeleton count={9} />
    </div>
  );
}
