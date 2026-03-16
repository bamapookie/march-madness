import { Skeleton } from "@/components/ui/skeleton";

export default function LeaderboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <Skeleton className="mb-6 h-4 w-32" />
      <Skeleton className="mb-8 h-8 w-48" />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              {["Rank", "Participant", "Men's", "Women's", "Total"].map((h) => (
                <th key={h} className="pb-2 text-left">
                  <Skeleton className="h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                {[1, 2, 3, 4, 5].map((j) => (
                  <td key={j} className="py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
