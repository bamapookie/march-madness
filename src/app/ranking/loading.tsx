import { Skeleton } from "@/components/ui/skeleton";

export default function RankingLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </main>
  );
}
