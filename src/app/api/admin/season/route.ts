import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/** PATCH /api/admin/season — update ESPN tournament IDs on the active season. */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ data: null, error: "Invalid request body" }, { status: 400 });
  }

  const { mensEspnTournamentId, womensEspnTournamentId, mensEspnGroupId, womensEspnGroupId } =
    body as Record<string, unknown>;

  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  if (!season) {
    return NextResponse.json(
      { data: null, error: "No active tournament season found" },
      { status: 404 }
    );
  }

  const updated = await db.tournamentSeason.update({
    where: { id: season.id },
    data: {
      ...(typeof mensEspnTournamentId === "string" || mensEspnTournamentId === null
        ? { mensEspnTournamentId: mensEspnTournamentId ?? null }
        : {}),
      ...(typeof womensEspnTournamentId === "string" || womensEspnTournamentId === null
        ? { womensEspnTournamentId: womensEspnTournamentId ?? null }
        : {}),
      ...(typeof mensEspnGroupId === "string" || mensEspnGroupId === null
        ? { mensEspnGroupId: (mensEspnGroupId as string | null) ?? null }
        : {}),
      ...(typeof womensEspnGroupId === "string" || womensEspnGroupId === null
        ? { womensEspnGroupId: (womensEspnGroupId as string | null) ?? null }
        : {}),
    },
    select: {
      id: true,
      name: true,
      mensEspnTournamentId: true,
      womensEspnTournamentId: true,
      mensEspnGroupId: true,
      womensEspnGroupId: true,
    },
  });

  return NextResponse.json({ data: updated, error: null });
}
