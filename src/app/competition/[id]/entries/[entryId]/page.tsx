import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewCompetition } from "@/lib/competition";
import { BracketViewer } from "@/components/bracket/bracket-viewer";
import type {
  CompetitionSettings,
  ActualResultItem,
  ResolvedBracketData,
  ScoreBreakdownJson,
} from "@/types";

interface Props {
  params: Promise<{ id: string; entryId: string }>;
}

function scoreRow(label: string, mens: number, womens: number) {
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-2 text-zinc-600 dark:text-zinc-400">{label}</td>
      <td className="py-2 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
        {mens.toLocaleString()}
      </td>
      <td className="py-2 text-right text-zinc-700 tabular-nums dark:text-zinc-300">
        {womens.toLocaleString()}
      </td>
      <td className="py-2 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
        {(mens + womens).toLocaleString()}
      </td>
    </tr>
  );
}

export default async function EntryDetailPage({ params }: Props) {
  const { id: competitionId, entryId } = await params;

  const session = await auth();
  if (!session?.user?.id)
    redirect(`/sign-in?callbackUrl=/competition/${competitionId}/entries/${entryId}`);
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

  const entry = await db.competitionEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      competitionId: true,
      userId: true,
      submittedAt: true,
      user: { select: { name: true } },
      rankingList: { select: { id: true, name: true } },
      resolvedBracket: { select: { mensJson: true, womensJson: true } },
      score: {
        select: {
          mensScore: true,
          womensScore: true,
          totalScore: true,
          tiebreaker: true,
          maxPotentialRemaining: true,
          breakdownJson: true,
          computedAt: true,
        },
      },
    },
  });

  if (!entry || entry.competitionId !== competitionId) redirect(`/competition/${competitionId}`);

  const settings = comp.settingsJson as CompetitionSettings;

  const resultsRaw = await db.tournamentResult.findMany({
    where: { seasonId: season.id },
    select: { bracketSlotId: true, winningSchoolId: true, losingSchoolId: true },
  });
  const actualResults: ActualResultItem[] = resultsRaw.map((r) => ({
    bracketSlotId: r.bracketSlotId,
    winningSchoolId: r.winningSchoolId,
    losingSchoolId: r.losingSchoolId,
  }));

  const inProgressSlots = await db.bracketSlot.findMany({
    where: { seasonId: season.id, isInProgress: true },
    select: { id: true },
  });

  const schools = await db.school.findMany({
    where: { seasonId: season.id },
    select: { id: true, name: true, shortName: true },
  });
  const schoolNames: Record<string, string> = {};
  for (const s of schools) {
    schoolNames[s.id] = s.shortName ?? s.name;
  }

  const breakdown = entry.score?.breakdownJson as ScoreBreakdownJson | null;
  const mensOriginal = entry.resolvedBracket?.mensJson as unknown as ResolvedBracketData | null;
  const womensOriginal = entry.resolvedBracket?.womensJson as unknown as ResolvedBracketData | null;

  const activeScoring = settings.scoring_mode;
  const showRA = activeScoring.includes("round_advancement");
  const showCW = activeScoring.includes("correct_winner");
  const showBonus = settings.seeding_bonus_enabled;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <Link
        href={`/competition/${competitionId}/leaderboard`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Leaderboard
      </Link>

      <h1 className="mb-1 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {entry.rankingList.name}
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        Submitted by {entry.user.name ?? "Unknown"} ·{" "}
        {new Date(entry.submittedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </p>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        {/* Score panel */}
        <div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-950">
            <h2 className="mb-4 text-base font-semibold text-zinc-700 dark:text-zinc-300">
              Score Summary
            </h2>

            {!entry.score ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                Scores not yet computed. Check back once the tournament is under way.
              </p>
            ) : (
              <>
                {/* Totals */}
                <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Men&apos;s</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {entry.score.mensScore.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Women&apos;s</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {entry.score.womensScore.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500">Total</p>
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                      {entry.score.totalScore.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mb-3 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span title="Lower is better — rewards balanced Men's/Women's knowledge">
                    Tiebreaker: {entry.score.tiebreaker}
                  </span>
                  <span>
                    Max remaining:{" "}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {entry.score.maxPotentialRemaining !== null
                        ? entry.score.maxPotentialRemaining.toLocaleString()
                        : "—"}
                    </strong>
                  </span>
                </div>

                {/* Breakdown table */}
                {breakdown && (
                  <>
                    <h3 className="mb-2 text-xs font-medium tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                      Breakdown
                    </h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-100 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                          <th className="py-1.5 text-left font-normal">Method</th>
                          <th className="py-1.5 text-right font-normal">M</th>
                          <th className="py-1.5 text-right font-normal">W</th>
                          <th className="py-1.5 text-right font-normal">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {showCW &&
                          scoreRow(
                            "Correct Winner",
                            breakdown.mens.correctWinner,
                            breakdown.womens.correctWinner
                          )}
                        {showRA &&
                          scoreRow(
                            "Round Advancement",
                            breakdown.mens.roundAdvancement,
                            breakdown.womens.roundAdvancement
                          )}
                        {showBonus &&
                          scoreRow(
                            "Seeding Bonus",
                            breakdown.mens.seedingBonus,
                            breakdown.womens.seedingBonus
                          )}
                        <tr>
                          <td className="py-2 font-semibold text-zinc-700 dark:text-zinc-300">
                            Total
                          </td>
                          <td className="py-2 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                            {breakdown.mens.total.toLocaleString()}
                          </td>
                          <td className="py-2 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">
                            {breakdown.womens.total.toLocaleString()}
                          </td>
                          <td className="py-2 text-right font-bold text-blue-600 tabular-nums dark:text-blue-400">
                            {breakdown.total.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  Updated{" "}
                  {entry.score.computedAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Bracket panel */}
        <div>
          <h2 className="mb-4 text-base font-semibold text-zinc-700 dark:text-zinc-300">Bracket</h2>
          <BracketViewer
            resolvedBracketMens={mensOriginal}
            resolvedBracketWomens={womensOriginal}
            actualResults={actualResults}
            inProgressSlotIds={inProgressSlots.map((s) => s.id)}
            schoolNames={schoolNames}
            showScore={true}
          />
        </div>
      </div>
    </main>
  );
}
