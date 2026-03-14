import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isJoinCutoffPassed, isCompetitionLocked } from "@/lib/competition";
import type { ApiResponse, CompetitionSummary } from "@/types";

// ─── POST /api/competitions/[id]/rotate-code ──────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ data: null, error: "Unauthorized" } satisfies ApiResponse<null>, {
      status: 401,
    });
  }

  const { id } = await params;
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });

  const comp = await db.competition.findUnique({ where: { id } });
  if (!comp) {
    return Response.json(
      { data: null, error: "Competition not found" } satisfies ApiResponse<null>,
      { status: 404 }
    );
  }

  if (comp.organizerId !== userId) {
    return Response.json(
      {
        data: null,
        error: "Forbidden — only the organizer can rotate the join code",
      } satisfies ApiResponse<null>,
      { status: 403 }
    );
  }

  if (isJoinCutoffPassed(comp.joinCutoffAt)) {
    return Response.json(
      {
        data: null,
        error: "Join cutoff has passed — code rotation is no longer allowed",
      } satisfies ApiResponse<null>,
      { status: 409 }
    );
  }

  if (season) {
    const settings = comp.settingsJson as CompetitionSummary["settings"];
    if (isCompetitionLocked(settings, season)) {
      return Response.json(
        {
          data: null,
          error: "Competition is locked — code rotation is no longer allowed",
        } satisfies ApiResponse<null>,
        { status: 409 }
      );
    }
  }

  const newCode = randomBytes(4).toString("hex");
  await db.competition.update({ where: { id }, data: { joinCode: newCode } });

  return Response.json({ data: { joinCode: newCode }, error: null } satisfies ApiResponse<{
    joinCode: string;
  }>);
}
