import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn("skeleton", className)} />;
}

export function ProjectCardSkeleton() {
  return (
    <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-5 flex items-center gap-4">
      <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
      </div>
      <Skeleton className="w-16 h-4 rounded" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
