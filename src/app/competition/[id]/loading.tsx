import { Skeleton } from "@/components/ui/skeleton";

export default function CompetitionLobbyLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-24" />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="mb-6 h-10 w-full" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          <Skeleton className="mb-3 h-5 w-36" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="space-y-2">
          <Skeleton className="mb-3 h-5 w-24" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
