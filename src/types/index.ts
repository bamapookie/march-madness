// ─── API ─────────────────────────────────────────────────────────────────────

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Points awarded per round for `round_points` and `correct_winner_points`.
 * Each key represents points for *winning* a game in that round.
 * - For `correct_winner_points`: awarded when the predicted slot winner actually wins.
 * - For `round_points`: awarded when a team wins a game in a round where they were
 *   originally predicted to win (capped at their predicted exit round).
 * `championship` = winning the championship game. For `round_points`, this only
 * applies to teams originally predicted to win the championship.
 */
export type RoundPointMap = {
  first_four: number;
  round_of_64: number;
  round_of_32: number;
  sweet_16: number;
  elite_8: number;
  final_four: number;
  championship: number;
};

/**
 * Points awarded for the seeding accuracy bonus.
 * Distinguishes between losing in the championship game vs. winning it,
 * since "winning the championship" is its own predicted exit point.
 */
export type SeedingBonusPointMap = {
  first_four: number;
  round_of_64: number;
  round_of_32: number;
  sweet_16: number;
  elite_8: number;
  final_four: number;
  championship_runner_up: number; // predicted to lose in the championship game
  championship_winner: number; // predicted to win the championship
};

// ─── Competition Settings ─────────────────────────────────────────────────────

/**
 * Stored as JSON in Competition.settingsJson.
 * Governs scoring, lock timing, and bracket reseeding for a competition.
 */
export type CompetitionSettings = {
  /** Maximum number of ranking lists a single user may submit to this competition. */
  max_lists_per_user: number;
  /**
   * When participant ranking lists are locked.
   * - "before_first_four": locks before any games are played; First Four points possible.
   * - "before_round_of_64": locks after First Four results; no First Four points awarded.
   */
  lock_mode: "before_first_four" | "before_round_of_64";
  /**
   * Which scoring modes are active. At least one must be selected.
   * - "correct_winner": points for each game whose predicted winner actually won (traditional bracket scoring).
   * - "round_advancement": points for each round a team actually reaches, up to their predicted exit
   *   round, based on original bracket resolution. Gives additional scoring weight to original
   *   predictions independently of reseeding. Only meaningfully distinct from correct_winner when
   *   reseed_mode = "reseed_by_ranking"; do not combine both modes when using fixed.
   */
  scoring_mode: Array<"round_advancement" | "correct_winner">;
  // ...existing code...
  /**
   * How the bracket is updated when real results deviate from predictions.
   * - "fixed": predictions are never updated; eliminated teams' future game slots earn no points.
   * - "reseed_by_ranking": eliminated teams are replaced by actual advancing
   *   teams; matchup winner re-evaluated by original rank position.
   */
  reseed_mode: "fixed" | "reseed_by_ranking";
  /**
   * Points per round for the round advancement scoring mode.
   * Awarded for each game a team wins in a round where they were originally predicted to win,
   * based on original bracket resolution. Uses the same per-round map semantics as
   * `correct_winner_points`; capped at (not including) the predicted exit round.
   */
  round_points: RoundPointMap;
  /** Points per round for the correct winner scoring mode. */
  correct_winner_points: RoundPointMap;
};

// ─── Ranking Lists ────────────────────────────────────────────────────────────

export type LockModeType = "BEFORE_FIRST_FOUR" | "BEFORE_ROUND_OF_64";

/** Summary of a school shown inside a ranking list entry. */
export type SchoolSummary = {
  id: string;
  name: string;
  shortName: string | null;
  abbreviation: string | null;
  isInMensTournament: boolean;
  isInWomensTournament: boolean;
  mensSeed: number | null;
  womensSeed: number | null;
  mensRegion: string | null;
  womensRegion: string | null;
  /** Pre-computed average seed for display sorting. */
  averageSeed: number;
};

/** A single entry in a ranking list, including its school details. */
export type RankingEntryWithSchool = {
  id: string;
  rank: number;
  school: SchoolSummary;
};

/** Lightweight summary returned by the list endpoint. */
export type RankingListSummary = {
  id: string;
  name: string;
  lockMode: LockModeType;
  entryCount: number;
  isLocked: boolean;
  lockAt: string; // ISO-8601
  createdAt: string;
  updatedAt: string;
};

/** Full detail including all entries, returned by the single-list endpoint. */
export type RankingListDetail = {
  id: string;
  name: string;
  lockMode: LockModeType;
  isLocked: boolean;
  lockAt: string; // ISO-8601
  entries: RankingEntryWithSchool[];
  createdAt: string;
  updatedAt: string;
};
