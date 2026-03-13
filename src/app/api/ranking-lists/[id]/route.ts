import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAverageSeed, getLockAt, isRankingListLocked } from "@/lib/ranking";
import type { ApiResponse, RankingListDetail, SchoolSummary } from "@/types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/ranking-lists/[id] ─────────────────────────────────────────────

export async function GET(_req: Request, { params }: RouteContext): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;

  const list = await db.rankingList.findUnique({
    where: { id },
    include: {
      season: true,
      entries: {
        include: { school: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!list) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }
  if (list.userId !== session.user.id) {
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const result: RankingListDetail = {
    id: list.id,
    name: list.name,
    lockMode: list.lockMode,
    isLocked: isRankingListLocked(list.season, list.lockMode),
    lockAt: getLockAt(list.season, list.lockMode).toISOString(),
    entries: list.entries.map((e) => {
      const school: SchoolSummary = {
        id: e.school.id,
        name: e.school.name,
        shortName: e.school.shortName,
        abbreviation: e.school.abbreviation,
        isInMensTournament: e.school.isInMensTournament,
        isInWomensTournament: e.school.isInWomensTournament,
        mensSeed: e.school.mensSeed,
        womensSeed: e.school.womensSeed,
        mensRegion: e.school.mensRegion,
        womensRegion: e.school.womensRegion,
        averageSeed: getAverageSeed(e.school),
      };
      return { id: e.id, rank: e.rank, school };
    }),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };

  return Response.json({ data: result, error: null } satisfies ApiResponse<RankingListDetail>);
}

// ─── PATCH /api/ranking-lists/[id] ───────────────────────────────────────────

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;

  const list = await db.rankingList.findUnique({
    where: { id },
    include: { season: true },
  });

  if (!list) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }
  if (list.userId !== session.user.id) {
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }
  if (isRankingListLocked(list.season, list.lockMode)) {
    return Response.json({ data: null, error: "Rankings are locked" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return Response.json({ data: null, error: "Name is required" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const updated = await db.rankingList.update({ where: { id }, data: { name } });

  return Response.json({
    data: { id: updated.id, name: updated.name },
    error: null,
  } satisfies ApiResponse<{ id: string; name: string }>);
}

// ─── DELETE /api/ranking-lists/[id] ──────────────────────────────────────────

export async function DELETE(_req: Request, { params }: RouteContext): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;

  const list = await db.rankingList.findUnique({
    where: { id },
    include: { competitionEntries: { select: { id: true }, take: 1 } },
  });

  if (!list) {
    return Response.json(
      { data: null, error: "Ranking list not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }
  if (list.userId !== session.user.id) {
    return Response.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }
  if (list.competitionEntries.length > 0) {
    return Response.json(
      {
        data: null,
        error: "Cannot delete a ranking list that has been submitted to a competition.",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  await db.rankingList.delete({ where: { id } });

  return Response.json({ data: { id }, error: null } satisfies ApiResponse<{ id: string }>);
}
