import { Skeleton } from "@/components/ui/skeleton";

export default function EntryDetailLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-32" />
      <Skeleton className="mb-8 h-8 w-64" />
      <div className="mb-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <Skeleton className="mb-4 h-5 w-32" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <Skeleton className="mb-4 h-6 w-24" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    </main>
  );
}
