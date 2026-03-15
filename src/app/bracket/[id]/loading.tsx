import { Skeleton } from "@/components/ui/skeleton";

export default function BracketLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-32" />
      <Skeleton className="mb-8 h-8 w-56" />
      <Skeleton className="mb-4 h-10 w-full max-w-xs" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-32 w-full" />
    </main>
  );
}
