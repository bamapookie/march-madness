import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveInitialBracket } from "@/lib/bracket";
import { BracketViewer } from "@/components/bracket/bracket-viewer";
import type { ActualResultItem, BracketSlotInput, ResolvedBracketData, Round } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BracketViewerPage({ params }: Props) {
  const { id: rankingListId } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/bracket/${rankingListId}`);
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) redirect("/dashboard");

  const rankingList = await db.rankingList.findUnique({
    where: { id: rankingListId },
    select: {
      id: true,
      userId: true,
      name: true,
      entries: { select: { schoolId: true, rank: true } },
    },
  });

  if (!rankingList || rankingList.userId !== userId) redirect("/dashboard");

  const rankMap: Record<string, number> = {};
  for (const e of rankingList.entries) {
    rankMap[e.schoolId] = e.rank;
  }

  const slotsRaw = await db.bracketSlot.findMany({
    where: { seasonId: season.id },
    select: {
      id: true,
      gender: true,
      round: true,
      slotIndex: true,
      region: true,
      schoolId: true,
      nextSlotId: true,
      feedingSlots: { select: { id: true } },
    },
  });

  const toInput = (s: (typeof slotsRaw)[number]): BracketSlotInput => ({
    id: s.id,
    round: s.round as Round,
    slotIndex: s.slotIndex,
    region: s.region,
    schoolId: s.schoolId,
    nextSlotId: s.nextSlotId,
    feedingSlotIds: s.feedingSlots.map((f) => f.id),
  });

  const mensSlots = slotsRaw.filter((s) => s.gender === "MENS").map(toInput);
  const womensSlots = slotsRaw.filter((s) => s.gender === "WOMENS").map(toInput);

  let mensBracket: ResolvedBracketData | null = null;
  let womensBracket: ResolvedBracketData | null = null;

  if (mensSlots.length > 0 && womensSlots.length > 0) {
    try {
      mensBracket = resolveInitialBracket({ gender: "MENS", slots: mensSlots, rankMap });
      womensBracket = resolveInitialBracket({ gender: "WOMENS", slots: womensSlots, rankMap });
    } catch {
      // bracket resolution failed — show placeholder
    }
  }

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

  const hasTournamentStarted = actualResults.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <Link
        href={`/ranking/${rankingListId}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to Ranking List
      </Link>

      <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {rankingList.name} — Bracket Preview
      </h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        How your ranking resolves into a bracket. No score overlays — this is a preview of your
        picks.
      </p>

      {!mensBracket && !womensBracket ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Bracket slots are not yet available for this season. Check back after Selection Sunday.
        </div>
      ) : (
        <BracketViewer
          resolvedBracketMens={mensBracket}
          resolvedBracketWomens={womensBracket}
          actualResults={actualResults}
          inProgressSlotIds={inProgressSlots.map((s) => s.id)}
          schoolNames={schoolNames}
          showScore={hasTournamentStarted}
        />
      )}
    </main>
  );
}
