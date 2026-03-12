import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAverageSeed, isRankingListLocked } from "@/lib/ranking";
import type { ApiResponse, RankingEntryWithSchool, SchoolSummary } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── PUT /api/ranking-lists/[id]/entries ─────────────────────────────────────
// Accepts an ordered array of school IDs and atomically replaces all entries.

export async function PUT(request: Request, { params }: RouteContext): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json(
      { data: null, error: "Unauthorized" } satisfies ApiResponse<null>,
      { status: 401 },
    );
  }

  const { id } = await params;

  const list = await db.rankingList.findUnique({
    where: { id },
    include: {
      season: true,
      entries: { include: { school: true } },
    },
  });

  if (!list) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 },
    );
  }
  if (list.userId !== session.user.id) {
    return Response.json(
      { data: null, error: "Forbidden" } satisfies ApiResponse<null>,
      { status: 403 },
    );
  }
  if (isRankingListLocked(list.season, list.lockMode)) {
    return Response.json(
      { data: null, error: "Rankings are locked" } satisfies ApiResponse<null>,
      { status: 403 },
    );
  }

  const body = (await request.json()) as { orderedSchoolIds?: string[] };
  if (!Array.isArray(body.orderedSchoolIds)) {
    return Response.json(
      { data: null, error: "orderedSchoolIds must be an array" } satisfies ApiResponse<null>,
      { status: 400 },
    );
  }

  const { orderedSchoolIds } = body;
  const currentIds = new Set(list.entries.map((e) => e.schoolId));
  const newIds = new Set(orderedSchoolIds);

  // Validate: same schools, no duplicates, same count
  if (
    orderedSchoolIds.length !== list.entries.length ||
    orderedSchoolIds.length !== newIds.size ||
    ![...currentIds].every((sid) => newIds.has(sid))
  ) {
    return Response.json(
      {
        data: null,
        error: "orderedSchoolIds must contain exactly the same schools as the current ranking list with no duplicates.",
      } satisfies ApiResponse<null>,
      { status: 400 },
    );
  }

  // Build school lookup from existing entries (avoids a second DB round-trip)
  const schoolMap = new Map(list.entries.map((e) => [e.schoolId, e.school]));

  // Atomic replace: delete then create inside a transaction
  const newEntries = await db.$transaction(async (tx) => {
    await tx.rankingEntry.deleteMany({ where: { rankingListId: id } });

    await tx.rankingEntry.createMany({
      data: orderedSchoolIds.map((schoolId, idx) => ({
        rankingListId: id,
        schoolId,
        rank: idx + 1,
      })),
    });

    await tx.rankingList.update({ where: { id }, data: { updatedAt: new Date() } });

    return tx.rankingEntry.findMany({
      where: { rankingListId: id },
      orderBy: { rank: "asc" },
    });
  });

  const entries: RankingEntryWithSchool[] = newEntries.map((entry) => {
    const s = schoolMap.get(entry.schoolId)!;
    const school: SchoolSummary = {
      id: s.id,
      name: s.name,
      shortName: s.shortName,
      abbreviation: s.abbreviation,
      isInMensTournament: s.isInMensTournament,
      isInWomensTournament: s.isInWomensTournament,
      mensSeed: s.mensSeed,
      womensSeed: s.womensSeed,
      mensRegion: s.mensRegion,
      womensRegion: s.womensRegion,
      averageSeed: getAverageSeed(s),
    };
    return { id: entry.id, rank: entry.rank, school };
  });

  return Response.json(
    { data: { entries }, error: null } satisfies ApiResponse<{ entries: RankingEntryWithSchool[] }>,
  );
}

