import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isJoinable } from "@/lib/competition";
import type { ApiResponse } from "@/types";

// ─── POST /api/competitions/join ──────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  let body: { code?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ data: null, error: "Invalid JSON body" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) {
    return Response.json({ data: null, error: "code is required" } satisfies ApiResponse<null>, {
      status: 400,
    });
  }

  const comp = await db.competition.findUnique({ where: { joinCode: code } });
  if (!comp) {
    return Response.json({ data: null, error: "Invalid join code" } satisfies ApiResponse<null>, {
      status: 404,
    });
  }

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) {
    return Response.json(
      { data: null, error: "No active tournament season" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  // Check if already a member (idempotent)
  const existing = await db.competitionMember.findUnique({
    where: { competitionId_userId: { competitionId: comp.id, userId: session.user.id } },
  });

  if (existing) {
    return Response.json({
      data: { competitionId: comp.id, alreadyMember: true },
      error: null,
    } satisfies ApiResponse<{
      competitionId: string;
      alreadyMember: boolean;
    }>);
  }

  if (!isJoinable(comp, season)) {
    return Response.json(
      {
        data: null,
        error: "This competition is no longer accepting new members",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  await db.competitionMember.create({
    data: { competitionId: comp.id, userId: session.user.id },
  });

  return Response.json(
    { data: { competitionId: comp.id, alreadyMember: false }, error: null } satisfies ApiResponse<{
      competitionId: string;
      alreadyMember: boolean;
    }>,
    { status: 201 }
  );
}
