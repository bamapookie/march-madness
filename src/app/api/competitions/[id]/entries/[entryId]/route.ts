import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCompetitionLocked } from "@/lib/competition";
import type { ApiResponse, CompetitionSummary } from "@/types";

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

  const settings = entry.competition.settingsJson as CompetitionSummary["settings"];

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
