import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCompetitionLocked } from "@/lib/competition";
import type { ApiResponse, CompetitionEntrySummary, CompetitionSummary } from "@/types";

// ─── POST /api/competitions/[id]/entries ──────────────────────────────────────

export async function POST(
  request: Request,
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

  let body: { rankingListId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const rankingListId = typeof body.rankingListId === "string" ? body.rankingListId : "";
  if (!rankingListId) {
    return Response.json(
      { data: null, error: "rankingListId is required" } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  const comp = await db.competition.findUnique({ where: { id: competitionId } });
  if (!comp) {
    return Response.json(
      { data: null, error: "Competition not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  // Must be a member
  const membership = await db.competitionMember.findUnique({
    where: { competitionId_userId: { competitionId, userId } },
  });
  if (!membership) {
    return Response.json(
      { data: null, error: "You must be a member to submit an entry" } satisfies ApiResponse<null>,
      { status: 403 }
    );
  }

  const settings = comp.settingsJson as CompetitionSummary["settings"];

  // Must not be locked
  if (isCompetitionLocked(settings, season)) {
    return Response.json(
      {
        data: null,
        error: "Competition is locked — no entries can be added",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  // Validate ranking list ownership and lockMode match
  const rankingList = await db.rankingList.findUnique({ where: { id: rankingListId } });
  if (!rankingList) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }
  if (rankingList.userId !== userId) {
    return Response.json(
      { data: null, error: "You do not own this ranking list" } satisfies ApiResponse<null>,
      { status: 403 }
    );
  }

  // Lock mode must match: competition setting vs. ranking list lock mode
  const expectedLockMode =
    settings.lock_mode === "before_first_four" ? "BEFORE_FIRST_FOUR" : "BEFORE_ROUND_OF_64";
  if (rankingList.lockMode !== expectedLockMode) {
    return Response.json(
      {
        data: null,
        error: `Ranking list lock mode does not match this competition's lock mode (expected ${settings.lock_mode.replace(/_/g, " ")})`,
      } satisfies ApiResponse<null>,
      { status: 400 }
    );
  }

  // Max entries per user
  const existingCount = await db.competitionEntry.count({
    where: { competitionId, userId },
  });
  if (existingCount >= settings.max_lists_per_user) {
    return Response.json(
      {
        data: null,
        error: `You have reached the maximum number of entries (${settings.max_lists_per_user}) for this competition`,
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  // Prevent duplicate ranking list in the same competition
  const duplicateEntry = await db.competitionEntry.findUnique({
    where: { competitionId_rankingListId: { competitionId, rankingListId } },
  });
  if (duplicateEntry) {
    return Response.json(
      {
        data: null,
        error: "This ranking list is already submitted to this competition",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  const entry = await db.competitionEntry.create({
    data: { competitionId, userId, rankingListId },
    include: {
      user: { select: { name: true } },
      rankingList: { select: { id: true, name: true } },
    },
  });

  const result: CompetitionEntrySummary = {
    id: entry.id,
    userId: entry.userId,
    userName: entry.user.name,
    rankingListId: entry.rankingList.id,
    rankingListName: entry.rankingList.name,
    submittedAt: entry.submittedAt.toISOString(),
  };

  return Response.json(
    { data: result, error: null } satisfies ApiResponse<CompetitionEntrySummary>,
    { status: 201 }
  );
}
