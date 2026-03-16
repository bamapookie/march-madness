import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canViewCompetition,
  getLockAtForCompetition,
  isCompetitionLocked,
} from "@/lib/competition";
import type { CompetitionSettings } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

export default async function LeaderboardPage({ params }: Props) {
  const { id: competitionId } = await params;

  const session = await auth();
  if (!session?.user?.id)
    redirect(`/sign-in?callbackUrl=/competition/${competitionId}/leaderboard`);
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) redirect("/competition");

  const comp = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      name: true,
      organizerId: true,
      isPublic: true,
      joinCutoffAt: true,
      settingsJson: true,
    },
  });
  if (!comp) redirect("/competition");

  const isMember = !!(await db.competitionMember.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
  }));
  const hasEntry = !!(await db.competitionEntry.findFirst({
    where: { competitionId, userId },
  }));

  if (
    !canViewCompetition(
      {
        organizerId: comp.organizerId,
        isPublic: comp.isPublic,
        joinCutoffAt: comp.joinCutoffAt,
        settingsJson: comp.settingsJson,
      },
      season,
      userId,
      isMember,
      hasEntry
    )
  ) {
    redirect(`/competition/${competitionId}`);
  }

  const settings = comp.settingsJson as CompetitionSettings;
  const isLocked = isCompetitionLocked(settings, season);
  const lockAt = getLockAtForCompetition(settings, season);

  // Guard: require at least one result
  const firstResult = await db.tournamentResult.findFirst({ where: { seasonId: season.id } });
  if (!firstResult) {
    redirect(`/competition/${competitionId}`);
  }

  // Load leaderboard data
  const entryScores = await db.entryScore.findMany({
    where: { competitionEntry: { competitionId } },
    select: {
      competitionEntryId: true,
      mensScore: true,
      womensScore: true,
      totalScore: true,
      tiebreaker: true,
      maxPotentialRemaining: true,
      computedAt: true,
      competitionEntry: {
        select: {
          id: true,
          userId: true,
          submittedAt: true,
          user: { select: { name: true, image: true } },
          rankingList: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [
      { totalScore: "desc" },
      { tiebreaker: "asc" },
      { competitionEntry: { submittedAt: "asc" } },
    ],
  });

  // Also load entries without scores yet
  const allEntries = await db.competitionEntry.findMany({
    where: { competitionId },
    select: {
      id: true,
      userId: true,
      submittedAt: true,
      user: { select: { name: true, image: true } },
      rankingList: { select: { id: true, name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const scoredIds = new Set(entryScores.map((s) => s.competitionEntryId));

  // Assign ranks (handle ties)
  type Row = {
    rank: number | null;
    entryId: string;
    userId: string;
    userName: string | null;
    userImage: string | null;
    rankingListName: string;
    mensScore: number;
    womensScore: number;
    totalScore: number;
    tiebreaker: number;
    maxPotentialRemaining: number | null;
    computedAt: Date | null;
  };

  const rows: Row[] = [];
  let rank = 1;
  let sameRankCount = 0;
  let prevTotal: number | null = null;
  let prevTiebreaker: number | null = null;
  let effectiveRank = 1;

  for (const s of entryScores) {
    const isSame = s.totalScore === prevTotal && s.tiebreaker === prevTiebreaker;
    if (!isSame) {
      effectiveRank = rank;
    }
    rows.push({
      rank: effectiveRank,
      entryId: s.competitionEntry.id,
      userId: s.competitionEntry.userId,
      userName: s.competitionEntry.user.name,
      userImage: s.competitionEntry.user.image,
      rankingListName: s.competitionEntry.rankingList.name,
      mensScore: s.mensScore,
      womensScore: s.womensScore,
      totalScore: s.totalScore,
      tiebreaker: s.tiebreaker,
      maxPotentialRemaining: s.maxPotentialRemaining,
      computedAt: s.computedAt,
    });
    prevTotal = s.totalScore;
    prevTiebreaker = s.tiebreaker;
    sameRankCount++;
    if (!isSame) {
      rank = sameRankCount + (prevTotal !== null ? rows.length - sameRankCount + 1 : 1);
      sameRankCount = 0;
    }
  }

  for (const e of allEntries) {
    if (scoredIds.has(e.id)) continue;
    rows.push({
      rank: null,
      entryId: e.id,
      userId: e.userId,
      userName: e.user.name,
      userImage: e.user.image,
      rankingListName: e.rankingList.name,
      mensScore: 0,
      womensScore: 0,
      totalScore: 0,
      tiebreaker: 0,
      maxPotentialRemaining: null,
      computedAt: null,
    });
  }

  const lastComputedAt =
    entryScores.length > 0
      ? entryScores.reduce(
          (max, s) => (s.computedAt > max ? s.computedAt : max),
          entryScores[0].computedAt
        )
      : null;

  void isLocked;
  void lockAt;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <Link
        href={`/competition/${competitionId}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to Competition
      </Link>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {comp.name} — Leaderboard
        </h1>
        {lastComputedAt && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Last updated{" "}
            {lastComputedAt.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No entries submitted yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Participant</th>
                <th className="px-3 py-3">Entry</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell">Men&apos;s</th>
                <th className="hidden px-3 py-3 text-right sm:table-cell">Women&apos;s</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th
                  className="hidden px-3 py-3 text-right md:table-cell"
                  title="Maximum points still earnable"
                >
                  Max Left
                </th>
                <th
                  className="hidden px-3 py-3 text-right md:table-cell"
                  title="Absolute difference between Men's and Women's scores. Lower is better."
                >
                  Tiebreaker ↑
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr
                  key={row.entryId}
                  className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                    row.userId === userId
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : "bg-white dark:bg-zinc-950"
                  }`}
                >
                  <td className="px-3 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                    {row.rank ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      {row.userImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.userImage}
                          alt={row.userName ?? ""}
                          className="h-6 w-6 rounded-full"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {(row.userName ?? "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {row.userName ?? "Unknown"}
                        {row.userId === userId && (
                          <span className="ml-1 text-xs text-zinc-400">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/competition/${competitionId}/entries/${row.entryId}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.rankingListName}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-3 text-right text-zinc-700 tabular-nums sm:table-cell dark:text-zinc-300">
                    {fmt(row.computedAt ? row.mensScore : null)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-zinc-700 tabular-nums sm:table-cell dark:text-zinc-300">
                    {fmt(row.computedAt ? row.womensScore : null)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                    {fmt(row.computedAt ? row.totalScore : null)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-zinc-500 tabular-nums md:table-cell dark:text-zinc-400">
                    {fmt(row.maxPotentialRemaining)}
                  </td>
                  <td className="hidden px-3 py-3 text-right text-zinc-500 tabular-nums md:table-cell dark:text-zinc-400">
                    {fmt(row.computedAt ? row.tiebreaker : null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
