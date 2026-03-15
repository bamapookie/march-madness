import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  canViewCompetition,
  getLockAtForCompetition,
  isCompetitionLocked,
} from "@/lib/competition";
import type {
  ApiResponse,
  CompetitionSettings,
  LeaderboardEntry,
  LeaderboardResponse,
} from "@/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id: competitionId } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const comp = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      organizerId: true,
      isPublic: true,
      joinCutoffAt: true,
      settingsJson: true,
    },
  });
  if (!comp) {
    return Response.json(
      { data: null, error: "Competition not found" } satisfies ApiResponse<null>,
      {
        status: 404,
      }
    );
  }

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
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const settings = comp.settingsJson as CompetitionSettings;
  const isLocked = isCompetitionLocked(settings, season);
  const lockAt = getLockAtForCompetition(settings, season);

  // Load all entry scores for this competition
  const entryScores = await db.entryScore.findMany({
    where: {
      competitionEntry: { competitionId },
    },
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
          rankingList: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { totalScore: "desc" },
      { tiebreaker: "asc" },
      { competitionEntry: { submittedAt: "asc" } },
    ],
  });

  // Also load entries with no score yet (scored = 0)
  const allEntries = await db.competitionEntry.findMany({
    where: { competitionId },
    select: {
      id: true,
      userId: true,
      submittedAt: true,
      user: { select: { name: true, image: true } },
      rankingList: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const scoredIds = new Set(entryScores.map((s) => s.competitionEntryId));

  // Build leaderboard rows — scored entries first, then unscored
  const rows: LeaderboardEntry[] = [];
  let rank = 1;
  let prevScore: number | null = null;
  let prevTiebreaker: number | null = null;
  let sameRankCount = 0;

  for (const s of entryScores) {
    const isSameRank = s.totalScore === prevScore && s.tiebreaker === prevTiebreaker;
    if (!isSameRank) {
      rank += sameRankCount;
      sameRankCount = 1;
    } else {
      sameRankCount++;
    }
    const effectiveRank = isSameRank ? rank : rank;
    prevScore = s.totalScore;
    prevTiebreaker = s.tiebreaker;

    rows.push({
      rank: effectiveRank,
      entryId: s.competitionEntry.id,
      userId: s.competitionEntry.userId,
      userName: s.competitionEntry.user.name,
      userAvatar: s.competitionEntry.user.image,
      rankingListName: s.competitionEntry.rankingList.name,
      mensScore: s.mensScore,
      womensScore: s.womensScore,
      totalScore: s.totalScore,
      tiebreaker: s.tiebreaker,
      maxPotentialRemaining: s.maxPotentialRemaining,
      computedAt: s.computedAt.toISOString(),
    });
  }

  // Append unscored entries without a rank
  for (const e of allEntries) {
    if (scoredIds.has(e.id)) continue;
    rows.push({
      rank: 0, // 0 = not yet ranked
      entryId: e.id,
      userId: e.userId,
      userName: e.user.name,
      userAvatar: e.user.image,
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
      ? entryScores
          .reduce((max, s) => (s.computedAt > max ? s.computedAt : max), entryScores[0].computedAt)
          .toISOString()
      : null;

  const response: LeaderboardResponse = {
    entries: rows,
    isLocked,
    lastComputedAt,
  };

  // Validate lock time matches what we expect
  void lockAt; // used for future display

  return Response.json({ data: response, error: null } satisfies ApiResponse<LeaderboardResponse>);
}
