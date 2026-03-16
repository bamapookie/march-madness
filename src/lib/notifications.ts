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
 * Notifies every unique user who has at least one scored entry (totalScore > 0)
 * in the given season that their scores have been updated. Fires one notification
 * per user per competition, linking directly to that competition's leaderboard.
 * Skips silently when no real game scores exist yet (all entries still at 0).
 */
export async function notifyScoresUpdated(seasonId: string): Promise<void> {
  try {
    // Collect entries with non-zero scores so pre-tournament cron ticks are silent
    const entries = await db.competitionEntry.findMany({
      where: {
        competition: { seasonId },
        score: { totalScore: { gt: 0 } },
      },
      select: {
        userId: true,
        competitionId: true,
      },
    });

    if (entries.length === 0) return;

    // Group user IDs by competition (deduplicated)
    const competitionUsers = new Map<string, Set<string>>();
    for (const e of entries) {
      if (!competitionUsers.has(e.competitionId)) {
        competitionUsers.set(e.competitionId, new Set());
      }
      competitionUsers.get(e.competitionId)!.add(e.userId);
    }

    // One notification per user per competition, linking to that competition's leaderboard
    for (const [competitionId, userIds] of competitionUsers) {
      for (const userId of userIds) {
        await createNotification(
          userId,
          "Scores updated",
          "New tournament results are in — check your leaderboard position.",
          `/competition/${competitionId}/leaderboard`
        );
      }
    }
  } catch (err) {
    console.warn("[notifications] notifyScoresUpdated failed:", err);
  }
}
