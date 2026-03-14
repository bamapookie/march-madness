import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewCompetition, isCompetitionLocked } from "@/lib/competition";
import type {
  ApiResponse,
  CompetitionSettings,
  CompetitionSummary,
  EntryDetailResponse,
  EntryScoreDetail,
  ScoreBreakdownJson,
  ResolvedBracketData,
  ActualResultItem,
} from "@/types";

// ─── GET /api/competitions/[id]/entries/[entryId] ─────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id: competitionId, entryId } = await params;
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
      { status: 404 }
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

  if (!entry || entry.competitionId !== competitionId) {
    return Response.json({ data: null, error: "Entry not found" } satisfies ApiResponse<null>, {
      status: 404,
    });
  }

  // Load actual results for the season
  const resultsRaw = await db.tournamentResult.findMany({
    where: { seasonId: season.id },
    select: { bracketSlotId: true, winningSchoolId: true, losingSchoolId: true },
  });
  const actualResults: ActualResultItem[] = resultsRaw.map((r) => ({
    bracketSlotId: r.bracketSlotId,
    winningSchoolId: r.winningSchoolId,
    losingSchoolId: r.losingSchoolId,
  }));

  // Load in-progress slot IDs
  const inProgressSlots = await db.bracketSlot.findMany({
    where: { seasonId: season.id, isInProgress: true },
    select: { id: true },
  });
  const inProgressSlotIds = inProgressSlots.map((s) => s.id);

  const scoreDetail: EntryScoreDetail | null = entry.score
    ? {
        entryId: entry.id,
        rankingListId: entry.rankingList.id,
        rankingListName: entry.rankingList.name,
        mensScore: entry.score.mensScore,
        womensScore: entry.score.womensScore,
        totalScore: entry.score.totalScore,
        tiebreaker: entry.score.tiebreaker,
        maxPotentialRemaining: entry.score.maxPotentialRemaining,
        breakdown: entry.score.breakdownJson as ScoreBreakdownJson | null,
        computedAt: entry.score.computedAt.toISOString(),
      }
    : null;

  const resolvedBracket = entry.resolvedBracket
    ? {
        mens: entry.resolvedBracket.mensJson as unknown as ResolvedBracketData,
        womens: entry.resolvedBracket.womensJson as unknown as ResolvedBracketData,
      }
    : null;

  // BracketViewer expects a combined object; we pass mens and womens separately via the component
  // The API returns them as a single object with both genders for the viewer
  const response: EntryDetailResponse = {
    entry: {
      id: entry.id,
      userId: entry.userId,
      userName: entry.user.name,
      rankingListId: entry.rankingList.id,
      rankingListName: entry.rankingList.name,
      submittedAt: entry.submittedAt.toISOString(),
    },
    score: scoreDetail,
    resolvedBracket: resolvedBracket?.mens ?? null,
    actualResults,
    inProgressSlotIds,
  };

  // We need both genders — extend the response with womens bracket
  const extendedResponse = {
    ...response,
    resolvedBracketMens: resolvedBracket?.mens ?? null,
    resolvedBracketWomens: resolvedBracket?.womens ?? null,
  };

  return Response.json({ data: extendedResponse, error: null });
}

// ─── DELETE /api/competitions/[id]/entries/[entryId] ──────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id: competitionId, entryId } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const entry = await db.competitionEntry.findUnique({
    where: { id: entryId },
    include: { competition: true },
  });

  if (!entry || entry.competitionId !== competitionId) {
    return Response.json({ data: null, error: "Entry not found" } satisfies ApiResponse<null>, {
      status: 404,
    });
  }

  const settings = entry.competition.settingsJson as CompetitionSettings;

  if (isCompetitionLocked(settings, season)) {
    return Response.json(
      {
        data: null,
        error: "Competition is locked — entries cannot be removed",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  const isOrganizer = entry.competition.organizerId === userId;
  const isOwner = entry.userId === userId;

  if (!isOrganizer && !isOwner) {
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  await db.competitionEntry.delete({ where: { id: entryId } });

  return Response.json({ data: { deleted: true }, error: null } satisfies ApiResponse<{
    deleted: boolean;
  }>);
}
