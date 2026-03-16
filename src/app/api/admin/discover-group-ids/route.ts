import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { discoverEspnGroupIds } from "@/lib/import";
import type { ApiResponse } from "@/types";

/** POST /api/admin/discover-group-ids — preview ESPN group IDs without saving them. */
export async function POST(): Promise<Response> {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ data: null, error: "Forbidden" } satisfies ApiResponse<null>, {
      status: 403,
    });
  }

  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: { mensEspnGroupId: true, womensEspnGroupId: true },
  });

  try {
    const result = await discoverEspnGroupIds(season ?? {});
    return NextResponse.json({ data: result, error: null } satisfies ApiResponse<{
      mens: string | null;
      womens: string | null;
    }>);
  } catch (err) {
    return NextResponse.json(
      {
        data: null,
        error: err instanceof Error ? err.message : "Discovery failed",
      } satisfies ApiResponse<null>,
      { status: 500 }
    );
  }
}
