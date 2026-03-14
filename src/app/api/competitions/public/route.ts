import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
} from "@/lib/competition";
import type { ApiResponse, CompetitionSummary } from "@/types";

// ─── GET /api/competitions/public ─────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json({ data: [], error: null } satisfies ApiResponse<CompetitionSummary[]>);
  }

  const now = new Date();

  const competitions = await db.competition.findMany({
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
  });

  // Determine membership and entry counts for the authenticated user
  let memberSet = new Set<string>();
  let entryCountMap = new Map<string, number>();

  if (userId) {
    const compIds = competitions.map((c) => c.id);

    const memberships = await db.competitionMember.findMany({
      where: { userId, competitionId: { in: compIds } },
      select: { competitionId: true },
    });
    memberSet = new Set(memberships.map((m) => m.competitionId));

    const entryCounts = await db.competitionEntry.groupBy({
      by: ["competitionId"],
      where: { userId, competitionId: { in: compIds } },
      _count: { id: true },
    });
    entryCountMap = new Map(entryCounts.map((e) => [e.competitionId, e._count.id]));
  }

  const result: CompetitionSummary[] = competitions.map((comp) => {
    const settings = comp.settingsJson as CompetitionSummary["settings"];
    const lockAt = getLockAtForCompetition(settings, season);
    return {
      id: comp.id,
      name: comp.name,
      description: comp.description,
      isPublic: comp.isPublic,
      organizerId: comp.organizerId,
      organizerName: comp.organizer.name,
      memberCount: comp._count.members,
      entryCount: comp._count.entries,
      isLocked: isCompetitionLocked(settings, season),
      lockAt: lockAt.toISOString(),
      joinCutoffAt: comp.joinCutoffAt ? comp.joinCutoffAt.toISOString() : null,
      isJoinable: !isCompetitionLocked(settings, season) && !isJoinCutoffPassed(comp.joinCutoffAt),
      joinCode: comp.joinCode,
      userEntryCount: entryCountMap.get(comp.id) ?? 0,
      isOrganizer: userId === comp.organizerId,
      isMember: memberSet.has(comp.id),
      settings,
    };
  });

  return Response.json({ data: result, error: null } satisfies ApiResponse<CompetitionSummary[]>);
}
