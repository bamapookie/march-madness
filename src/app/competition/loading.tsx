import { Skeleton } from "@/components/ui/skeleton";

export default function CompetitionLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-64" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </main>
  );
}
