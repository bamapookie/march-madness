import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLockAt, isRankingListLocked } from "@/lib/ranking";
import { CreateListButton } from "@/components/ranking/create-list-button";
import { RankingListCard } from "@/components/ranking/ranking-list-card";
import type { RankingListSummary } from "@/types";

export default async function RankingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const activeSeason = await db.tournamentSeason.findFirst({ where: { isActive: true } });

  const lists = activeSeason
    ? await db.rankingList.findMany({
        where: { userId: session.user.id, seasonId: activeSeason.id },
        include: { _count: { select: { entries: true } } },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const mappedLists: RankingListSummary[] = lists.map((list) => ({
    id: list.id,
    name: list.name,
    lockMode: list.lockMode,
    entryCount: list._count.entries,
    isLocked: activeSeason ? isRankingListLocked(activeSeason, list.lockMode) : false,
    lockAt: activeSeason
      ? getLockAt(activeSeason, list.lockMode).toISOString()
      : new Date().toISOString(),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">My Ranking Lists</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Rank all tournament schools — your list automatically resolves into both brackets.
          </p>
        </div>
        {activeSeason && <CreateListButton />}
      </div>

      {/* No active season */}
      {!activeSeason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          No active tournament season found. Ask an administrator to set up the season and import
          school data.
        </div>
      )}

      {/* Empty state */}
      {activeSeason && mappedLists.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="mb-4 text-zinc-500 dark:text-zinc-400">
            You haven&apos;t created any ranking lists yet.
          </p>
          <CreateListButton variant="ghost" />
        </div>
      )}

      {/* List */}
      {mappedLists.length > 0 && (
        <div className="space-y-3">
          {mappedLists.map((list) => (
            <RankingListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </main>
  );
}
