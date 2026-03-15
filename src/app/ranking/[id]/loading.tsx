import { Skeleton } from "@/components/ui/skeleton";

export default function RankingEditLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-24" />
      <Skeleton className="mb-8 h-8 w-56" />
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </main>
  );
}
