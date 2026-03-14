import type { CompetitionSettings, SeedingBonusPointMap, RoundPointMap } from "@/types";

// ─── Default settings ─────────────────────────────────────────────────────────

export function getDefaultCompetitionSettings(): CompetitionSettings {
  const round_points: RoundPointMap = {
    first_four: 1,
    round_of_64: 1,
    round_of_32: 2,
    sweet_16: 4,
    elite_8: 8,
    final_four: 16,
    championship: 32,
  };

  const correct_winner_points: RoundPointMap = {
    first_four: 2,
    round_of_64: 2,
    round_of_32: 4,
    sweet_16: 8,
    elite_8: 16,
    final_four: 32,
    championship: 64,
  };

  const seeding_bonus_points: SeedingBonusPointMap = {
    first_four: 1,
    round_of_64: 1,
    round_of_32: 2,
    sweet_16: 4,
    elite_8: 8,
    final_four: 16,
    championship_runner_up: 24,
    championship_winner: 32,
  };

  return {
    max_lists_per_user: 1,
    lock_mode: "before_first_four",
    scoring_mode: ["correct_winner"],
    seeding_bonus_enabled: false,
    reseed_mode: "fixed",
    round_points,
    correct_winner_points,
    seeding_bonus_points,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isRoundPointMap(v: unknown): v is RoundPointMap {
  if (typeof v !== "object" || v === null) return false;
  const keys: Array<keyof RoundPointMap> = [
    "first_four",
    "round_of_64",
    "round_of_32",
    "sweet_16",
    "elite_8",
    "final_four",
    "championship",
  ];
  return keys.every((k) => typeof (v as Record<string, unknown>)[k] === "number");
}

function isSeedingBonusPointMap(v: unknown): v is SeedingBonusPointMap {
  if (typeof v !== "object" || v === null) return false;
  const keys: Array<keyof SeedingBonusPointMap> = [
    "first_four",
    "round_of_64",
    "round_of_32",
    "sweet_16",
    "elite_8",
    "final_four",
    "championship_runner_up",
    "championship_winner",
  ];
  return keys.every((k) => typeof (v as Record<string, unknown>)[k] === "number");
}

export function validateCompetitionSettings(
  raw: unknown
): { valid: true; settings: CompetitionSettings } | { valid: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, error: "Settings must be an object" };
  }

  const s = raw as Record<string, unknown>;

  if (typeof s.max_lists_per_user !== "number" || s.max_lists_per_user < 1) {
    return { valid: false, error: "max_lists_per_user must be a positive number" };
  }

  if (s.lock_mode !== "before_first_four" && s.lock_mode !== "before_round_of_64") {
    return { valid: false, error: "lock_mode must be 'before_first_four' or 'before_round_of_64'" };
  }

  if (!Array.isArray(s.scoring_mode) || s.scoring_mode.length === 0) {
    return { valid: false, error: "scoring_mode must be a non-empty array" };
  }
  const validScoringModes = ["round_advancement", "correct_winner"];
  for (const mode of s.scoring_mode as unknown[]) {
    if (!validScoringModes.includes(mode as string)) {
      return {
        valid: false,
        error: "scoring_mode values must be 'round_advancement' or 'correct_winner'",
      };
    }
  }

  if (typeof s.seeding_bonus_enabled !== "boolean") {
    return { valid: false, error: "seeding_bonus_enabled must be a boolean" };
  }

  if (s.reseed_mode !== "fixed" && s.reseed_mode !== "reseed_by_ranking") {
    return { valid: false, error: "reseed_mode must be 'fixed' or 'reseed_by_ranking'" };
  }

  if (!isRoundPointMap(s.round_points)) {
    return { valid: false, error: "round_points is missing required numeric fields" };
  }

  if (!isRoundPointMap(s.correct_winner_points)) {
    return { valid: false, error: "correct_winner_points is missing required numeric fields" };
  }

  if (!isSeedingBonusPointMap(s.seeding_bonus_points)) {
    return { valid: false, error: "seeding_bonus_points is missing required numeric fields" };
  }

  return {
    valid: true,
    settings: {
      max_lists_per_user: s.max_lists_per_user as number,
      lock_mode: s.lock_mode as "before_first_four" | "before_round_of_64",
      scoring_mode: s.scoring_mode as Array<"round_advancement" | "correct_winner">,
      seeding_bonus_enabled: s.seeding_bonus_enabled as boolean,
      reseed_mode: s.reseed_mode as "fixed" | "reseed_by_ranking",
      round_points: s.round_points as RoundPointMap,
      correct_winner_points: s.correct_winner_points as RoundPointMap,
      seeding_bonus_points: s.seeding_bonus_points as SeedingBonusPointMap,
    },
  };
}

// ─── Lifecycle helpers ────────────────────────────────────────────────────────

export function getLockAtForCompetition(
  settings: CompetitionSettings,
  season: { firstFourLockAt: Date; roundOf64LockAt: Date }
): Date {
  return settings.lock_mode === "before_first_four"
    ? season.firstFourLockAt
    : season.roundOf64LockAt;
}

export function isCompetitionLocked(
  settings: CompetitionSettings,
  season: { firstFourLockAt: Date; roundOf64LockAt: Date }
): boolean {
  return new Date() >= getLockAtForCompetition(settings, season);
}

export function isJoinCutoffPassed(joinCutoffAt: Date | null): boolean {
  return joinCutoffAt !== null && new Date() >= joinCutoffAt;
}

export function isJoinable(
  competition: { joinCutoffAt: Date | null; settingsJson: unknown },
  season: { firstFourLockAt: Date; roundOf64LockAt: Date }
): boolean {
  const settings = competition.settingsJson as CompetitionSettings;
  return !isCompetitionLocked(settings, season) && !isJoinCutoffPassed(competition.joinCutoffAt);
}

/**
 * Whether a given user can view a competition's lobby.
 * Pre-cutoff: any member, or the public if isPublic=true.
 * Post-cutoff: only organizer or member who has ≥1 submitted entry.
 */
export function canViewCompetition(
  competition: {
    organizerId: string;
    isPublic: boolean;
    joinCutoffAt: Date | null;
    settingsJson: unknown;
  },
  season: { firstFourLockAt: Date; roundOf64LockAt: Date },
  userId: string | null,
  isMember: boolean,
  hasEntry: boolean
): boolean {
  const cutoffPassed = isJoinCutoffPassed(competition.joinCutoffAt);
  const locked = isCompetitionLocked(competition.settingsJson as CompetitionSettings, season);

  if (!cutoffPassed && !locked) {
    // Pre-cutoff: public competitions visible to all; private ones require membership
    if (competition.isPublic) return true;
    return userId !== null && (isMember || competition.organizerId === userId);
  }

  // Post-cutoff / locked: only organizer or entry-holders
  if (userId === null) return false;
  if (competition.organizerId === userId) return true;
  return hasEntry;
}

/**
 * Returns true if the given joinCutoffAt is valid (≤ lockAt).
 */
export function validateJoinCutoffAt(joinCutoffAt: Date, lockAt: Date): boolean {
  return joinCutoffAt <= lockAt;
}
