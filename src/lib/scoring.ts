import type {
  ActualResultItem,
  CompetitionSettings,
  GenderScoringInput,
  PredictedExitRound,
  ResolvedGame,
  Round,
  RoundPointMap,
  ScoreBreakdown,
  ScoreResult,
  ScoringInput,
  SeedingBonusPointMap,
} from "@/types";

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Maps a Round to the RoundPointMap key for round advancement scoring.
 * Direct 1:1 mapping — same semantics as correctWinnerKey.
 * Points are for WINNING a game in that round.
 */
function roundAdvancementKey(round: Round): keyof RoundPointMap {
  const map: Record<Round, keyof RoundPointMap> = {
    FIRST_FOUR: "first_four",
    ROUND_OF_64: "round_of_64",
    ROUND_OF_32: "round_of_32",
    SWEET_16: "sweet_16",
    ELITE_8: "elite_8",
    FINAL_FOUR: "final_four",
    CHAMPIONSHIP: "championship",
  };
  return map[round];
}

/**
 * Maps a Round to the correct_winner_points key.
 * Direct 1:1 mapping.
 */
function correctWinnerKey(round: Round): keyof RoundPointMap {
  return roundAdvancementKey(round);
}

/**
 * Maps a PredictedExitRound to the seeding_bonus_points key.
 */
function predictedExitToSeedingBonusKey(exit: PredictedExitRound): keyof SeedingBonusPointMap {
  const map: Record<PredictedExitRound, keyof SeedingBonusPointMap> = {
    FIRST_FOUR: "first_four",
    ROUND_OF_64: "round_of_64",
    ROUND_OF_32: "round_of_32",
    SWEET_16: "sweet_16",
    ELITE_8: "elite_8",
    FINAL_FOUR: "final_four",
    CHAMPIONSHIP_RUNNER_UP: "championship_runner_up",
    CHAMPIONSHIP_WINNER: "championship_winner",
  };
  return map[exit];
}

/**
 * Returns true if this round should be excluded from scoring because
 * lock_mode = "before_round_of_64" and the round is FIRST_FOUR.
 */
function isExcludedByLockMode(
  round: Round | PredictedExitRound,
  lockMode: CompetitionSettings["lock_mode"]
): boolean {
  return lockMode === "before_round_of_64" && round === "FIRST_FOUR";
}

/**
 * Determines the actual exit round for a school from real results.
 * Returns null if the school has not yet been eliminated (still alive or
 * tournament incomplete).
 */
function computeActualExit(
  schoolId: string,
  actualResultBySlotId: Map<string, ActualResultItem>,
  games: ResolvedGame[]
): PredictedExitRound | null {
  for (const game of games) {
    const result = actualResultBySlotId.get(game.slotId);
    if (result === undefined) continue;

    if (result.losingSchoolId === schoolId) {
      return game.round === "CHAMPIONSHIP"
        ? "CHAMPIONSHIP_RUNNER_UP"
        : (game.round as PredictedExitRound);
    }
    if (result.winningSchoolId === schoolId && game.round === "CHAMPIONSHIP") {
      return "CHAMPIONSHIP_WINNER";
    }
  }
  return null;
}

// ─── scoreGender ──────────────────────────────────────────────────────────────

function scoreGender(input: GenderScoringInput, settings: CompetitionSettings): ScoreBreakdown {
  const { originalBracket, currentBracket, actualResults } = input;

  // Index actual results by slot id for O(1) lookup
  const actualResultBySlotId = new Map<string, ActualResultItem>();
  for (const result of actualResults) {
    actualResultBySlotId.set(result.bracketSlotId, result);
  }

  let roundAdvancement = 0;
  let correctWinner = 0;
  let seedingBonus = 0;

  // ── PER-GAME SCORING ────────────────────────────────────────────────────────
  for (const G of currentBracket.games) {
    const result = actualResultBySlotId.get(G.slotId);
    if (result === undefined) continue; // game not yet played

    if (isExcludedByLockMode(G.round, settings.lock_mode)) continue;

    // Correct winner — uses currentBracket (reseeded predictions if applicable)
    if (settings.scoring_mode.includes("correct_winner")) {
      const key = correctWinnerKey(G.round);
      if (G.predictedWinnerId === result.winningSchoolId) {
        correctWinner += settings.correct_winner_points[key];
      }
    }

    // Round advancement — uses originalBracket only
    if (settings.scoring_mode.includes("round_advancement")) {
      const advKey = roundAdvancementKey(G.round);
      const originalGame = originalBracket.games.find((g) => g.slotId === G.slotId);
      if (originalGame !== undefined && originalGame.predictedWinnerId === result.winningSchoolId) {
        roundAdvancement += settings.round_points[advKey];
      }
    }
  }

  // ── PER-SCHOOL SEEDING ACCURACY BONUS ──────────────────────────────────────
  if (settings.seeding_bonus_enabled) {
    for (const [schoolId, predictedExit] of Object.entries(originalBracket.predictedExitRound)) {
      if (isExcludedByLockMode(predictedExit as Round, settings.lock_mode)) {
        continue;
      }

      const actualExit = computeActualExit(schoolId, actualResultBySlotId, originalBracket.games);
      if (actualExit !== null && actualExit === predictedExit) {
        const bonusKey = predictedExitToSeedingBonusKey(predictedExit);
        seedingBonus += settings.seeding_bonus_points[bonusKey];
      }
    }
  }

  const total = roundAdvancement + correctWinner + seedingBonus;
  return { roundAdvancement, correctWinner, seedingBonus, total };
}

// ─── scoreEntry (public export) ───────────────────────────────────────────────

/**
 * Compute a combined score from two resolved brackets vs. actual results,
 * under the given competition settings.
 *
 * Pure function — no DB access, no async I/O.
 */
export function scoreEntry(input: ScoringInput): ScoreResult {
  const mensBreakdown = scoreGender(input.mens, input.settings);
  const womensBreakdown = scoreGender(input.womens, input.settings);

  const mensScore = mensBreakdown.total;
  const womensScore = womensBreakdown.total;
  const totalScore = mensScore + womensScore;
  const tiebreaker = Math.abs(mensScore - womensScore);

  return {
    mensScore,
    womensScore,
    totalScore,
    tiebreaker,
    breakdown: { mens: mensBreakdown, womens: womensBreakdown },
  };
}

// Re-export helpers used in tests (via named exports for testability)
export { computeActualExit, isExcludedByLockMode, roundAdvancementKey, correctWinnerKey };
