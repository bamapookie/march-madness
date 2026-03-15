import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-2 h-8 w-24" />
      <Skeleton className="mb-8 h-4 w-64" />
      <div className="space-y-8">
        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i}>
                <Skeleton className="mb-1 h-3 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
