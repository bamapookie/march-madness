import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
} from "@/lib/competition";
import { CompetitionCard } from "@/components/competition/competition-card";
import type { CompetitionSettings, CompetitionSummary } from "@/types";

export default async function CompetitionPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  const now = new Date();

  // ── Public competitions ───────────────────────────────────────────────────
  const publicComps = season
    ? await db.competition.findMany({
        where: {
          seasonId: season.id,
          isPublic: true,
          OR: [{ joinCutoffAt: null }, { joinCutoffAt: { gt: now } }],
        },
        include: {
          organizer: { select: { name: true } },
          _count: { select: { members: true, entries: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // ── Member competitions ───────────────────────────────────────────────────
  let myComps: typeof publicComps = [];
  let myEntryCountMap = new Map<string, number>();
  let myMemberSet = new Set<string>();

  if (userId && season) {
    const memberships = await db.competitionMember.findMany({
      where: { userId, competition: { seasonId: season.id } },
      select: { competitionId: true },
    });
    const memberIds = memberships.map((m) => m.competitionId);

    myComps = await db.competition.findMany({
      where: { id: { in: memberIds } },
      include: {
        organizer: { select: { name: true } },
        _count: { select: { members: true, entries: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const entryCounts = await db.competitionEntry.groupBy({
      by: ["competitionId"],
      where: { userId, competitionId: { in: memberIds } },
      _count: { id: true },
    });
    myEntryCountMap = new Map(entryCounts.map((e) => [e.competitionId, e._count.id]));
    myMemberSet = new Set(memberIds);
  }

  function mapComp(
    comp: (typeof publicComps)[number],
    isMember: boolean,
    userEntryCount: number
  ): CompetitionSummary {
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
      userEntryCount,
      isOrganizer: userId === comp.organizerId,
      isMember,
      settings,
    };
  }

  const publicList = publicComps.map((c) =>
    mapComp(c, myMemberSet.has(c.id), myEntryCountMap.get(c.id) ?? 0)
  );

  const myList = myComps.map((c) => mapComp(c, true, myEntryCountMap.get(c.id) ?? 0));

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Competitions</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create or join a competition group to compete with friends.
          </p>
        </div>
        {userId && (
          <Link
            href="/competition/create"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            + Create Competition
          </Link>
        )}
      </div>

      {/* My Competitions */}
      {userId && (
        <section className="mb-10">
          <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">
            My Competitions
          </h2>
          {myList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              You haven&apos;t joined any competitions yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myList.map((c) => (
                <CompetitionCard key={c.id} competition={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Public Lobby */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">
          Browse Public Competitions
        </h2>
        {publicList.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No public competitions are currently open.
            {userId && (
              <>
                {" "}
                <Link
                  href="/competition/create"
                  className="underline hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Create one!
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {publicList.map((c) => (
              <CompetitionCard key={c.id} competition={c} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
