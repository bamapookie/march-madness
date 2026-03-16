import { db } from "@/lib/db";

/**
 * Creates an in-app notification for the given user.
 * Fire-and-forget safe — errors are caught and logged, never rethrown.
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  try {
    await db.notification.create({
      data: { userId, title, body, link: link ?? null },
    });
  } catch (err) {
    console.warn("[notifications] Failed to create notification:", err);
  }
}

/**
 * Notifies every unique user who has at least one scored entry in the given season
 * that their scores have been updated. Deduplicates by userId so each user gets at
 * most one notification per recomputeAllScores run, regardless of how many entries
 * they have or how many competitions they are in.
 */
export async function notifyScoresUpdated(seasonId: string): Promise<void> {
  try {
    // Collect distinct user IDs with scored entries in this season
    const entries = await db.competitionEntry.findMany({
      where: { competition: { seasonId }, score: { isNot: null } },
      select: { userId: true, competitionId: true },
    });

    const notified = new Set<string>();
    for (const e of entries) {
      if (notified.has(e.userId)) continue;
      notified.add(e.userId);
      await createNotification(
        e.userId,
        "Scores updated",
        "New tournament results are in — check your leaderboard position.",
        `/competition`
      );
    }
  } catch (err) {
    console.warn("[notifications] notifyScoresUpdated failed:", err);
  }
}
