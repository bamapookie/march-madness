import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLockAt, isRankingListLocked } from "@/lib/ranking";
import {
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
} from "@/lib/competition";
import { RankingListCard } from "@/components/ranking/ranking-list-card";
import { CompetitionCard } from "@/components/competition/competition-card";
import type { RankingListSummary, CompetitionSummary, CompetitionSettings } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });

  // ── Parallel queries ──────────────────────────────────────────────────────
  const [memberships, rankingListsRaw] = await Promise.all([
    season
      ? db.competitionMember.findMany({
          where: { userId, competition: { seasonId: season.id } },
          select: { competitionId: true },
        })
      : Promise.resolve([]),
    season
      ? db.rankingList.findMany({
          where: { userId, seasonId: season.id },
          include: { _count: { select: { entries: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const memberIds = memberships.map((m) => m.competitionId);

  const [competitionsRaw, entryCounts] = await Promise.all([
    memberIds.length > 0
      ? db.competition.findMany({
          where: { id: { in: memberIds } },
          include: {
            organizer: { select: { name: true } },
            _count: { select: { members: true, entries: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    memberIds.length > 0
      ? db.competitionEntry.groupBy({
          by: ["competitionId"],
          where: { userId, competitionId: { in: memberIds } },
          _count: { id: true },
        })
      : Promise.resolve([]),
  ]);

  const entryCountMap = new Map(entryCounts.map((e) => [e.competitionId, e._count.id]));

  // ── Map competitions ──────────────────────────────────────────────────────
  const competitions: CompetitionSummary[] = competitionsRaw.map((comp) => {
    const settings = comp.settingsJson as CompetitionSettings;
    const lockAt = season ? getLockAtForCompetition(settings, season) : new Date();
    return {
      id: comp.id,
      name: comp.name,
      description: comp.description,
      isPublic: comp.isPublic,
      organizerId: comp.organizerId,
      organizerName: comp.organizer.name,
      memberCount: comp._count.members,
      entryCount: comp._count.entries,
      isLocked: season ? isCompetitionLocked(settings, season) : false,
      lockAt: lockAt.toISOString(),
      joinCutoffAt: comp.joinCutoffAt ? comp.joinCutoffAt.toISOString() : null,
      isJoinable: season
        ? !isCompetitionLocked(settings, season) && !isJoinCutoffPassed(comp.joinCutoffAt)
        : false,
      joinCode: comp.joinCode,
      userEntryCount: entryCountMap.get(comp.id) ?? 0,
      isOrganizer: comp.organizerId === userId,
      isMember: true,
      settings,
    };
  });

  // ── Map ranking lists ─────────────────────────────────────────────────────
  const rankingLists: RankingListSummary[] = rankingListsRaw.map((list) => ({
    id: list.id,
    name: list.name,
    lockMode: list.lockMode,
    entryCount: list._count.entries,
    isLocked: season ? isRankingListLocked(season, list.lockMode) : false,
    lockAt: season ? getLockAt(season, list.lockMode).toISOString() : new Date().toISOString(),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Welcome back, {session.user.name ?? "there"}.
      </p>

      {/* My Competitions */}
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            My Competitions
          </h2>
          <Link
            href="/competition"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Browse →
          </Link>
        </div>

        {competitions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              You haven&apos;t joined any competitions yet.
            </p>
            <Link
              href="/competition"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Browse Competitions
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {competitions.map((c) => (
              <CompetitionCard key={c.id} competition={c} />
            ))}
          </div>
        )}
      </section>

      {/* My Ranking Lists */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-700 dark:text-zinc-300">
            My Ranking Lists
          </h2>
          <Link
            href="/ranking"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            All Rankings →
          </Link>
        </div>

        {rankingLists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center dark:border-zinc-700">
            <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
              You haven&apos;t created any ranking lists yet.
            </p>
            <Link
              href="/ranking"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Create a Ranking List
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rankingLists.map((list) => (
              <RankingListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
