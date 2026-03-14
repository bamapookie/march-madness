// ─── API ─────────────────────────────────────────────────────────────────────

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
};

// ─── Tournament Rounds & Gender ──────────────────────────────────────────────

/**
 * Tournament round identifiers — mirrors the Prisma Round enum.
 * Declared here so pure lib files never import from @/generated/prisma.
 */
export type Round =
  | "FIRST_FOUR"
  | "ROUND_OF_64"
  | "ROUND_OF_32"
  | "SWEET_16"
  | "ELITE_8"
  | "FINAL_FOUR"
  | "CHAMPIONSHIP";

export type Gender = "MENS" | "WOMENS";

/**
 * The round in which a school is predicted to exit the tournament.
 * Extends Round with two championship-specific outcomes because "winning the
 * championship" is distinct from "being the runner-up" for seeding bonus purposes.
 */
export type PredictedExitRound =
  | "FIRST_FOUR"
  | "ROUND_OF_64"
  | "ROUND_OF_32"
  | "SWEET_16"
  | "ELITE_8"
  | "FINAL_FOUR"
  | "CHAMPIONSHIP_RUNNER_UP" // predicted to lose in the championship game
  | "CHAMPIONSHIP_WINNER"; // predicted to win the championship

// ─── Bracket Resolution ───────────────────────────────────────────────────────

/** Maps schoolId → rank position (1 = highest-ranked; lower is better). */
export type RankMap = Record<string, number>;

/**
 * A flattened representation of one BracketSlot DB row,
 * suitable for passing to pure bracket functions.
 *
 * SLOT SEMANTICS:
 *   • Leaf slots  (feedingSlotIds.length === 0, schoolId set):
 *       A team's starting position. No game is played here.
 *   • Game slots  (feedingSlotIds.length === 2):
 *       A game between the occupants of the two feeding slots.
 *   • The `round` field names the round in which this slot's GAME is played.
 */
export type BracketSlotInput = {
  id: string;
  round: Round;
  slotIndex: number;
  region: string | null;
  schoolId: string | null; // set for leaf slots
  nextSlotId: string | null; // null only for the Championship slot
  feedingSlotIds: string[]; // exactly 0 (leaf) or 2 (game)
};

/**
 * One resolved game slot in a predicted bracket.
 */
export type ResolvedGame = {
  slotId: string;
  round: Round;
  slotIndex: number;
  region: string | null;
  feedingSlotIds: [string, string];
  topContestantId: string;
  bottomContestantId: string;
  predictedWinnerId: string;
  predictedLoserId: string;
};

/**
 * A fully resolved bracket for one gender.
 * Stored as JSON in ResolvedBracket.mensJson / womensJson.
 */
export type ResolvedBracketData = {
  gender: Gender;
  /** All games ordered by round (FIRST_FOUR first, CHAMPIONSHIP last). */
  games: ResolvedGame[];
  /**
   * Maps schoolId → predicted exit round.
   * Champion → "CHAMPIONSHIP_WINNER"; runner-up → "CHAMPIONSHIP_RUNNER_UP".
   */
  predictedExitRound: Record<string, PredictedExitRound>;
  championId: string;
  /** Maps slotId → schoolId for all leaf slots (starting positions). */
  leafOccupants: Record<string, string>;
};

/** Input to resolveInitialBracket. */
export type BracketResolutionInput = {
  gender: Gender;
  slots: BracketSlotInput[];
  rankMap: RankMap;
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

// ─── Results ─────────────────────────────────────────────────────────────────

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
  /** Whether the seeding accuracy bonus is enabled. */
  seeding_bonus_enabled: boolean;
  /** Per-round bonus points for correctly predicting a team's exit round. */
  seeding_bonus_points: SeedingBonusPointMap;
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

// ─── Results ─────────────────────────────────────────────────────────────────

/** One imported game result, mapping to one TournamentResult DB row. */
export type ActualResultItem = {
  bracketSlotId: string;
  winningSchoolId: string;
  losingSchoolId: string;
};

/** Input for one gender's scoring. */
export type GenderScoringInput = {
  /**
   * The original resolved bracket (from resolveInitialBracket).
   * Used for: round advancement, seeding accuracy bonus.
   */
  originalBracket: ResolvedBracketData;
  /**
   * The current resolved bracket after applying real results.
   * For fixed mode: identical to originalBracket (pass the same object).
   * For reseed_by_ranking mode: the output of applyActualResults.
   * Used for: correct winner scoring.
   */
  currentBracket: ResolvedBracketData;
  actualResults: ActualResultItem[];
};

/** Full input to scoreEntry. */
export type ScoringInput = {
  mens: GenderScoringInput;
  womens: GenderScoringInput;
  settings: CompetitionSettings;
};

/** Per-gender score breakdown. */
export type ScoreBreakdown = {
  roundAdvancement: number;
  correctWinner: number;
  seedingBonus: number;
  total: number;
};

/** Output of scoreEntry. */
export type ScoreResult = {
  mensScore: number;
  womensScore: number;
  totalScore: number;
  /** Math.abs(mensScore - womensScore). Lower is better (tiebreaker). */
  tiebreaker: number;
  breakdown: {
    mens: ScoreBreakdown;
    womens: ScoreBreakdown;
  };
};

// ─── Competitions ────────────────────────────────────────────────────────────

/** Lightweight competition card for list views, the dashboard, and the public lobby. */
export type CompetitionSummary = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  organizerId: string;
  organizerName: string | null;
  memberCount: number;
  entryCount: number;
  isLocked: boolean;
  lockAt: string; // ISO-8601 — effective lock time for this competition
  joinCutoffAt: string | null; // ISO-8601 — null if no cutoff set
  isJoinable: boolean; // false after cutoff or lock
  joinCode: string; // used to build /join/[code] URL
  userEntryCount: number; // 0 for unauthenticated or non-member viewers
  isOrganizer: boolean;
  isMember: boolean;
  settings: CompetitionSettings;
};

/** Per-member row in the lobby. */
export type CompetitionMemberSummary = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  entryCount: number;
  joinedAt: string; // ISO-8601
};

/** Per-entry row in the lobby. */
export type CompetitionEntrySummary = {
  id: string;
  userId: string;
  userName: string | null;
  rankingListId: string;
  rankingListName: string;
  submittedAt: string; // ISO-8601
};

/** Full lobby payload returned by GET /api/competitions/[id]. */
export type CompetitionDetail = CompetitionSummary & {
  members: CompetitionMemberSummary[];
  entries: CompetitionEntrySummary[];
  userEntries: CompetitionEntrySummary[];
};

/** Body shape for PATCH /api/competitions/[id] (organizer updates, pre-cutoff only). */
export type CompetitionUpdateInput = {
  isPublic?: boolean;
  joinCutoffAt?: string | null; // ISO-8601 or null to clear
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

// ─── Scoring display ──────────────────────────────────────────────────────────

/**
 * Stored in EntryScore.breakdownJson.
 * Captures earned points broken down by scoring method and gender so the UI can
 * show exactly where every point came from.
 */
export type ScoreBreakdownJson = {
  mens: {
    roundAdvancement: number;
    correctWinner: number;
    seedingBonus: number;
    total: number;
  };
  womens: {
    roundAdvancement: number;
    correctWinner: number;
    seedingBonus: number;
    total: number;
  };
  total: number;
};

/** One row in the competition leaderboard. */
export type LeaderboardEntry = {
  rank: number;
  entryId: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  rankingListName: string;
  mensScore: number;
  womensScore: number;
  totalScore: number;
  /** Math.abs(mens - womens). Lower is better (tiebreaker). */
  tiebreaker: number;
  /** null = scoring has not yet run for this entry. */
  maxPotentialRemaining: number | null;
  computedAt: string | null; // ISO-8601; null = not yet computed
};

/** Response shape for GET /api/competitions/[id]/leaderboard */
export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  isLocked: boolean;
  lastComputedAt: string | null;
};

/** Score detail for one competition entry. */
export type EntryScoreDetail = {
  entryId: string;
  rankingListId: string;
  rankingListName: string;
  mensScore: number;
  womensScore: number;
  totalScore: number;
  tiebreaker: number;
  maxPotentialRemaining: number | null;
  breakdown: ScoreBreakdownJson | null;
  computedAt: string | null;
};

/** Response shape for GET /api/competitions/[id]/entries/[entryId] */
export type EntryDetailResponse = {
  entry: CompetitionEntrySummary;
  score: EntryScoreDetail | null;
  resolvedBracket: ResolvedBracketData | null;
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[];
};

/** Response shape for GET /api/ranking-lists/[id]/bracket */
export type BracketViewerResponse = {
  resolvedBracket: ResolvedBracketData;
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[];
  schoolNames: Record<string, string>;
};
