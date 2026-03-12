import type { LockMode } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLockAt, isRankingListLocked, sortSchoolsByDefaultRank } from "@/lib/ranking";
import type { ApiResponse, RankingListSummary } from "@/types";

// ─── GET /api/ranking-lists ───────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies ApiResponse<null>,
      { status: 401 },
    );
  }

  const activeSeason = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!activeSeason) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 },
    );
  }

  const lists = await db.rankingList.findMany({
    where: { userId: session.user.id, seasonId: activeSeason.id },
    include: { _count: { select: { entries: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const result: RankingListSummary[] = lists.map((list) => ({
    id: list.id,
    name: list.name,
    lockMode: list.lockMode,
    entryCount: list._count.entries,
    isLocked: isRankingListLocked(activeSeason, list.lockMode),
    lockAt: getLockAt(activeSeason, list.lockMode).toISOString(),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }));

  return Response.json({ data: result, error: null } satisfies ApiResponse<RankingListSummary[]>);
}

// ─── POST /api/ranking-lists ──────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies ApiResponse<null>,
      { status: 401 },
    );
  }

  let body: { name?: string; lockMode?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // empty body is fine — defaults below
  }

  const name = (body.name ?? "").trim() || "My Rankings";
  const lockMode: LockMode =
    body.lockMode === "BEFORE_ROUND_OF_64" ? "BEFORE_ROUND_OF_64" : "BEFORE_FIRST_FOUR";

  const activeSeason = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!activeSeason) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 },
    );
  }

  if (isRankingListLocked(activeSeason, lockMode)) {
    return Response.json(
      { data: null, error: "Rankings are locked for this competition type" } satisfies ApiResponse<null>,
      { status: 403 },
    );
  }

  // ── Determine which schools to include ───────────────────────────────────

  type SchoolRow = { id: string; name: string; mensSeed: number | null; womensSeed: number | null };
  let schools: SchoolRow[];

  if (lockMode === "BEFORE_FIRST_FOUR") {
    schools = await db.school.findMany({
      where: {
        seasonId: activeSeason.id,
        OR: [{ isInMensTournament: true }, { isInWomensTournament: true }],
      },
      select: { id: true, name: true, mensSeed: true, womensSeed: true },
    });
  } else {
    // BEFORE_ROUND_OF_64 — First Four results must be fully imported first
    const ffSlotCount = await db.bracketSlot.count({
      where: { seasonId: activeSeason.id, round: "FIRST_FOUR" },
    });

    if (ffSlotCount > 0) {
      const ffResultCount = await db.tournamentResult.count({
        where: { seasonId: activeSeason.id, bracketSlot: { round: "FIRST_FOUR" } },
      });

      if (ffResultCount < ffSlotCount) {
        return Response.json(
          {
            data: null,
            error:
              "First Four results have not been fully imported yet. Wait for all First Four games to finish or use the 'Before First Four' lock mode.",
          } satisfies ApiResponse<null>,
          { status: 400 },
        );
      }

      // Get First Four winners
      const ffWinners = await db.tournamentResult.findMany({
        where: { seasonId: activeSeason.id, bracketSlot: { round: "FIRST_FOUR" } },
        select: { winningSchoolId: true },
      });
      const ffWinnerIds = new Set(ffWinners.map((r) => r.winningSchoolId));

      // Include schools that are NOT in a First Four slot, plus First Four winners
      const allSchools = await db.school.findMany({
        where: {
          seasonId: activeSeason.id,
          OR: [{ isInMensTournament: true }, { isInWomensTournament: true }],
        },
        select: {
          id: true,
          name: true,
          mensSeed: true,
          womensSeed: true,
          bracketSlots: {
            where: { seasonId: activeSeason.id },
            select: { round: true },
          },
        },
      });

      schools = allSchools
        .filter((s) => {
          const inFirstFour = s.bracketSlots.some((slot) => slot.round === "FIRST_FOUR");
          return !inFirstFour || ffWinnerIds.has(s.id);
        })
        .map(({ id, name, mensSeed, womensSeed }) => ({ id, name, mensSeed, womensSeed }));
    } else {
      // No First Four bracket slots — include all tournament schools
      schools = await db.school.findMany({
        where: {
          seasonId: activeSeason.id,
          OR: [{ isInMensTournament: true }, { isInWomensTournament: true }],
        },
        select: { id: true, name: true, mensSeed: true, womensSeed: true },
      });
    }
  }

  if (schools.length === 0) {
    return Response.json(
      {
        data: null,
        error:
          "No tournament schools found for the active season. Please ask an administrator to import school data.",
      } satisfies ApiResponse<null>,
      { status: 422 },
    );
  }

  const sortedSchools = sortSchoolsByDefaultRank(schools);

  // ── Create list + entries in one transaction ─────────────────────────────

  const list = await db.$transaction(async (tx) => {
    const created = await tx.rankingList.create({
      data: {
        seasonId: activeSeason.id,
        userId: session.user!.id,
        name,
        lockMode,
      },
    });

    await tx.rankingEntry.createMany({
      data: sortedSchools.map((school, idx) => ({
        rankingListId: created.id,
        schoolId: school.id,
        rank: idx + 1,
      })),
    });

    return created;
  });

  return Response.json(
    {
      data: {
        id: list.id,
        name: list.name,
        lockMode: list.lockMode,
        entryCount: sortedSchools.length,
      },
      error: null,
    } satisfies ApiResponse<{ id: string; name: string; lockMode: LockMode; entryCount: number }>,
    { status: 201 },
  );
}


