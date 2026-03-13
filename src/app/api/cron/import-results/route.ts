import { NextRequest, NextResponse } from "next/server";
import { runFullImport } from "@/lib/import";
import { db } from "@/lib/db";

/**
 * GET /api/cron/import-results
 *
 * Called by Vercel Cron Jobs on the schedule defined in vercel.json.
 * Protected by CRON_SECRET — Vercel injects "Authorization: Bearer {secret}" on every call.
 *
 * Short-circuits early (returns 200 skipped) when:
 *   • No active tournament season exists
 *   • Current time is more than 3 weeks past the Round of 64 lock
 *     (tournament is over; no point polling ESPN)
 */
export async function GET(req: NextRequest) {
  // Validate the cron secret
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("[cron] CRON_SECRET environment variable is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load active season
  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: { id: true, firstFourLockAt: true, roundOf64LockAt: true },
  });

  if (!season) {
    return NextResponse.json({ skipped: true, reason: "No active season" });
  }

  // Skip if we are more than 3 weeks past the Round of 64 lock (tournament over)
  const now = new Date();
  const tournamentEndBuffer = new Date(season.roundOf64LockAt);
  tournamentEndBuffer.setDate(tournamentEndBuffer.getDate() + 21);

  if (now > tournamentEndBuffer) {
    return NextResponse.json({ skipped: true, reason: "Tournament window has passed" });
  }

  // Skip if we are more than 1 day before the First Four lock (not started yet)
  const firstFourStart = new Date(season.firstFourLockAt);
  firstFourStart.setDate(firstFourStart.getDate() - 1);
  if (now < firstFourStart) {
    return NextResponse.json({ skipped: true, reason: "Tournament has not started yet" });
  }

  const result = await runFullImport(season.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, result });
}


