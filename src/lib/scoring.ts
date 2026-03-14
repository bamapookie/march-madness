import type {
  ActualResultItem,
  CompetitionSettings,
  GenderScoringInput,
  PredictedExitRound,
  ResolvedBracketData,
  ResolvedGame,
  Round,
  RoundPointMap,
  ScoreBreakdown,
  ScoreBreakdownJson,
  ScoreResult,
  ScoringInput,
  SeedingBonusPointMap,
  BracketSlotInput,
  RankMap,
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

// ─── Round ordering ────────────────────────────────────────────────────────────

const ROUND_ORDER: Round[] = [
  "FIRST_FOUR",
  "ROUND_OF_64",
  "ROUND_OF_32",
  "SWEET_16",
  "ELITE_8",
  "FINAL_FOUR",
  "CHAMPIONSHIP",
];

function roundIndex(r: Round | PredictedExitRound): number {
  const normalised =
    r === "CHAMPIONSHIP_RUNNER_UP" || r === "CHAMPIONSHIP_WINNER" ? "CHAMPIONSHIP" : r;
  return ROUND_ORDER.indexOf(normalised as Round);
}

/** True when `a` is a round that comes strictly before `b` in tournament progression. */
function roundBefore(a: Round, b: Round | PredictedExitRound): boolean {
  return roundIndex(a) < roundIndex(b);
}

// ─── computeMaxPotential (per-gender) ─────────────────────────────────────────

/**
 * Computes the maximum additional points a user could still earn for one
 * gender's bracket.
 *
 * For fixed brackets: straightforward "if predicted winner is still alive, count
 * potential points for the unplayed slot".
 *
 * For reseeded brackets: three-case classification (see CLAUDE.md / plan doc).
 */
function computeMaxPotentialGender(
  originalBracket: ResolvedBracketData,
  currentBracket: ResolvedBracketData,
  actualResults: ActualResultItem[],
  settings: CompetitionSettings
): number {
  const playedSlotIds = new Set(actualResults.map((r) => r.bracketSlotId));
  const eliminatedSchools = new Set(actualResults.map((r) => r.losingSchoolId));

  // Build a map from slotId → original game for quick lookup in reseeded mode
  const originalGameBySlotId = new Map<string, ResolvedGame>();
  for (const g of originalBracket.games) {
    originalGameBySlotId.set(g.slotId, g);
  }

  let maxPotential = 0;

  for (const currentGame of currentBracket.games) {
    if (playedSlotIds.has(currentGame.slotId)) continue; // already played
    if (isExcludedByLockMode(currentGame.round, settings.lock_mode)) continue;

    const originalGame = originalGameBySlotId.get(currentGame.slotId);

    // Determine case: how many of the current contestants were in the original bracket for this slot?
    const isFixed = settings.reseed_mode === "fixed";
    const originalTeams = originalGame
      ? new Set([originalGame.topContestantId, originalGame.bottomContestantId])
      : new Set<string>();
    const currentTeams = [currentGame.topContestantId, currentGame.bottomContestantId];
    const originalInSlot = currentTeams.filter((t) => originalTeams.has(t));

    // Case A (reseeded): both contestants were replaced — only CW applies
    if (!isFixed && originalGame && originalInSlot.length === 0) {
      if (settings.scoring_mode.includes("correct_winner")) {
        maxPotential += settings.correct_winner_points[roundAdvancementKey(currentGame.round)];
      }
      continue;
    }

    // Case B: both original (or fixed bracket), Case C: mixed (one original, one reseeded)
    // For the predicted winner of the current (possibly reseeded) bracket:
    const currentWinner = currentGame.predictedWinnerId;
    const currentLoser = currentGame.predictedLoserId;

    // CW points — predicted winner
    if (settings.scoring_mode.includes("correct_winner") && !eliminatedSchools.has(currentWinner)) {
      maxPotential += settings.correct_winner_points[roundAdvancementKey(currentGame.round)];
    }

    // RA points — for original teams only (RA is tied to original bracket predictions)
    if (settings.scoring_mode.includes("round_advancement")) {
      // In fixed mode, currentWinner IS the original predicted winner
      // In reseeded Case B, also the same
      // In reseeded Case C: RA only applies if the winner is the original team
      const raCandidate = isFixed ? currentWinner : originalInSlot.find((t) => t === currentWinner);
      if (raCandidate && !eliminatedSchools.has(raCandidate)) {
        const originalPredictedExit = originalBracket.predictedExitRound[raCandidate];
        if (originalPredictedExit && roundBefore(currentGame.round, originalPredictedExit)) {
          maxPotential += settings.round_points[roundAdvancementKey(currentGame.round)];
        }
      }
    }

    // Seeding bonus — for the predicted loser if this is their predicted exit game
    if (settings.seeding_bonus_enabled) {
      // In fixed mode: check the original predicted loser
      // In reseeded Case B: same
      // In reseeded Case C: seeding bonus only for original teams
      const seedingCandidate =
        isFixed || originalInSlot.includes(currentLoser) ? currentLoser : null;

      if (seedingCandidate && !eliminatedSchools.has(seedingCandidate)) {
        const predictedExit = originalBracket.predictedExitRound[seedingCandidate];
        if (predictedExit) {
          const exitMatchesRound =
            (currentGame.round === "CHAMPIONSHIP" &&
              (predictedExit === "CHAMPIONSHIP_RUNNER_UP" ||
                predictedExit === "CHAMPIONSHIP_WINNER")) ||
            (currentGame.round !== "CHAMPIONSHIP" && currentGame.round === predictedExit);

          if (exitMatchesRound && !isExcludedByLockMode(predictedExit, settings.lock_mode)) {
            const bonusKey = predictedExitToSeedingBonusKey(predictedExit);
            maxPotential += settings.seeding_bonus_points[bonusKey];
          }
        }
      }

      // Championship winner bonus (only counted once for the predicted champion who hasn't been eliminated)
      if (
        currentGame.round === "CHAMPIONSHIP" &&
        !eliminatedSchools.has(currentWinner) &&
        (isFixed || originalInSlot.includes(currentWinner))
      ) {
        const predictedExit = originalBracket.predictedExitRound[currentWinner];
        if (predictedExit === "CHAMPIONSHIP_WINNER") {
          maxPotential += settings.seeding_bonus_points.championship_winner;
        }
      }
    }
  }

  return maxPotential;
}

// ─── recomputeAllScores ───────────────────────────────────────────────────────

/**
 * Recompute and cache bracket scores for all competition entries in the given season.
 * Called after every successful results import.
 */
export async function recomputeAllScores(seasonId: string): Promise<void> {
  const { db } = await import("@/lib/db");
  const { resolveInitialBracket, applyActualResults } = await import("@/lib/bracket");

  const season = await db.tournamentSeason.findUnique({
    where: { id: seasonId },
    select: { id: true, firstFourLockAt: true, roundOf64LockAt: true },
  });
  if (!season) {
    console.warn(`[scoring] recomputeAllScores: season ${seasonId} not found`);
    return;
  }

  // Load all tournament results for the season
  const allResults = await db.tournamentResult.findMany({
    where: { seasonId },
    select: { bracketSlotId: true, winningSchoolId: true, losingSchoolId: true },
  });

  // Load all bracket slots for the season (both genders)
  const allSlotsRaw = await db.bracketSlot.findMany({
    where: { seasonId },
    select: {
      id: true,
      gender: true,
      round: true,
      slotIndex: true,
      region: true,
      schoolId: true,
      nextSlotId: true,
      feedingSlots: { select: { id: true } },
    },
  });

  const toBracketSlotInput = (s: (typeof allSlotsRaw)[number]): BracketSlotInput => ({
    id: s.id,
    round: s.round as Round,
    slotIndex: s.slotIndex,
    region: s.region,
    schoolId: s.schoolId,
    nextSlotId: s.nextSlotId,
    feedingSlotIds: s.feedingSlots.map((f) => f.id),
  });

  const mensBracketSlots = allSlotsRaw.filter((s) => s.gender === "MENS").map(toBracketSlotInput);
  const womensBracketSlots = allSlotsRaw
    .filter((s) => s.gender === "WOMENS")
    .map(toBracketSlotInput);

  const mensSlotIds = new Set(mensBracketSlots.map((s) => s.id));
  const womensSlotIds = new Set(womensBracketSlots.map((s) => s.id));

  const mensActualResults: ActualResultItem[] = allResults
    .filter((r) => mensSlotIds.has(r.bracketSlotId))
    .map((r) => ({
      bracketSlotId: r.bracketSlotId,
      winningSchoolId: r.winningSchoolId,
      losingSchoolId: r.losingSchoolId,
    }));

  const womensActualResults: ActualResultItem[] = allResults
    .filter((r) => womensSlotIds.has(r.bracketSlotId))
    .map((r) => ({
      bracketSlotId: r.bracketSlotId,
      winningSchoolId: r.winningSchoolId,
      losingSchoolId: r.losingSchoolId,
    }));

  // Load all competitions for this season
  const competitions = await db.competition.findMany({
    where: { seasonId },
    select: { id: true, settingsJson: true },
  });

  for (const comp of competitions) {
    const settings = comp.settingsJson as CompetitionSettings;
    const lockAt =
      settings.lock_mode === "before_first_four" ? season.firstFourLockAt : season.roundOf64LockAt;

    if (new Date() < lockAt) continue; // competition not yet locked — skip all entries

    const entries = await db.competitionEntry.findMany({
      where: { competitionId: comp.id },
      select: {
        id: true,
        rankingList: {
          select: {
            entries: { select: { schoolId: true, rank: true } },
          },
        },
        resolvedBracket: { select: { id: true, mensJson: true, womensJson: true } },
      },
    });

    for (const entry of entries) {
      try {
        const rankMap: RankMap = {};
        for (const e of entry.rankingList.entries) {
          rankMap[e.schoolId] = e.rank;
        }

        if (mensBracketSlots.length === 0 || womensBracketSlots.length === 0) continue;

        // Resolve and cache the original bracket (set-once)
        let mensOriginal: ResolvedBracketData;
        let womensOriginal: ResolvedBracketData;

        if (entry.resolvedBracket) {
          mensOriginal = entry.resolvedBracket.mensJson as unknown as ResolvedBracketData;
          womensOriginal = entry.resolvedBracket.womensJson as unknown as ResolvedBracketData;
        } else {
          mensOriginal = resolveInitialBracket({
            gender: "MENS",
            slots: mensBracketSlots,
            rankMap,
          });
          womensOriginal = resolveInitialBracket({
            gender: "WOMENS",
            slots: womensBracketSlots,
            rankMap,
          });
          await db.resolvedBracket.create({
            data: {
              competitionEntryId: entry.id,
              mensJson: mensOriginal as unknown as Parameters<
                typeof db.resolvedBracket.create
              >[0]["data"]["mensJson"],
              womensJson: womensOriginal as unknown as Parameters<
                typeof db.resolvedBracket.create
              >[0]["data"]["womensJson"],
            },
          });
        }

        // Apply actual results for reseeding
        const mensCurrent =
          settings.reseed_mode === "reseed_by_ranking"
            ? applyActualResults(mensOriginal, mensActualResults, rankMap)
            : mensOriginal;
        const womensCurrent =
          settings.reseed_mode === "reseed_by_ranking"
            ? applyActualResults(womensOriginal, womensActualResults, rankMap)
            : womensOriginal;

        // Score the entry
        const scoreResult = scoreEntry({
          mens: {
            originalBracket: mensOriginal,
            currentBracket: mensCurrent,
            actualResults: mensActualResults,
          },
          womens: {
            originalBracket: womensOriginal,
            currentBracket: womensCurrent,
            actualResults: womensActualResults,
          },
          settings,
        });

        const breakdownJson: ScoreBreakdownJson = {
          mens: {
            roundAdvancement: scoreResult.breakdown.mens.roundAdvancement,
            correctWinner: scoreResult.breakdown.mens.correctWinner,
            seedingBonus: scoreResult.breakdown.mens.seedingBonus,
            total: scoreResult.breakdown.mens.total,
          },
          womens: {
            roundAdvancement: scoreResult.breakdown.womens.roundAdvancement,
            correctWinner: scoreResult.breakdown.womens.correctWinner,
            seedingBonus: scoreResult.breakdown.womens.seedingBonus,
            total: scoreResult.breakdown.womens.total,
          },
          total: scoreResult.totalScore,
        };

        const maxPotentialRemaining =
          computeMaxPotentialGender(mensOriginal, mensCurrent, mensActualResults, settings) +
          computeMaxPotentialGender(womensOriginal, womensCurrent, womensActualResults, settings);

        await db.entryScore.upsert({
          where: { competitionEntryId: entry.id },
          create: {
            competitionEntryId: entry.id,
            mensScore: scoreResult.mensScore,
            womensScore: scoreResult.womensScore,
            totalScore: scoreResult.totalScore,
            tiebreaker: scoreResult.tiebreaker,
            breakdownJson: breakdownJson as unknown as Parameters<
              typeof db.entryScore.upsert
            >[0]["create"]["breakdownJson"],
            maxPotentialRemaining,
          },
          update: {
            mensScore: scoreResult.mensScore,
            womensScore: scoreResult.womensScore,
            totalScore: scoreResult.totalScore,
            tiebreaker: scoreResult.tiebreaker,
            breakdownJson: breakdownJson as unknown as Parameters<
              typeof db.entryScore.upsert
            >[0]["update"]["breakdownJson"],
            maxPotentialRemaining,
            computedAt: new Date(),
          },
        });
      } catch (err) {
        console.warn(`[scoring] Failed to score entry ${entry.id}:`, err);
      }
    }
  }
}
