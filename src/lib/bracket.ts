import type {
  BracketResolutionInput,
  ActualResultItem,
  ResolvedBracketData,
  ResolvedGame,
  PredictedExitRound,
  Round,
  RankMap,
} from "@/types";

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

// ─── resolveInitialBracket ─────────────────────────────────────────────────────

/**
 * Walk the bracket slot tree bottom-up, determining a predicted winner for every
 * game using the user's rank map. Returns a fully populated ResolvedBracketData.
 *
 * Pure function — no DB access, no async I/O.
 */
export function resolveInitialBracket(input: BracketResolutionInput): ResolvedBracketData {
  const { gender, slots, rankMap } = input;

  // Tracks which school currently occupies each slot
  const occupantMap = new Map<string, string>();

  const games: ResolvedGame[] = [];
  const predictedExitRound: Record<string, PredictedExitRound> = {};
  const leafOccupants: Record<string, string> = {};

  // 1. Validate slot structure
  for (const slot of slots) {
    const n = slot.feedingSlotIds.length;
    if (n !== 0 && n !== 2) {
      throw new Error(`Slot ${slot.id} has ${n} feeding slots; expected 0 or 2`);
    }
  }

  // 2. Seed occupantMap with leaf slots
  for (const slot of slots) {
    if (slot.feedingSlotIds.length === 0) {
      if (slot.schoolId === null) {
        throw new Error(`Leaf slot ${slot.id} has no schoolId`);
      }
      occupantMap.set(slot.id, slot.schoolId);
      leafOccupants[slot.id] = slot.schoolId;
    }
  }

  // 3. Process game slots round by round
  for (const round of ROUND_ORDER) {
    const roundSlots = slots
      .filter((s) => s.round === round && s.feedingSlotIds.length === 2)
      .sort((a, b) => a.slotIndex - b.slotIndex);

    for (const slot of roundSlots) {
      if (slot.feedingSlotIds.length !== 2) {
        throw new Error(
          `Slot ${slot.id} has ${slot.feedingSlotIds.length} feeding slots; expected 0 or 2`
        );
      }
      const [topSlotId, bottomSlotId] = slot.feedingSlotIds;

      const topContestantId = occupantMap.get(topSlotId);
      const bottomContestantId = occupantMap.get(bottomSlotId);

      if (topContestantId === undefined) {
        throw new Error(
          `No occupant found for slot ${topSlotId} — possible missing round in bracket data`
        );
      }
      if (bottomContestantId === undefined) {
        throw new Error(
          `No occupant found for slot ${bottomSlotId} — possible missing round in bracket data`
        );
      }

      const topRank = rankMap[topContestantId];
      const bottomRank = rankMap[bottomContestantId];

      if (topRank === undefined) {
        throw new Error(`School ${topContestantId} not found in rank map`);
      }
      if (bottomRank === undefined) {
        throw new Error(`School ${bottomContestantId} not found in rank map`);
      }
      if (topRank === bottomRank) {
        throw new Error(
          `Rank tie between ${topContestantId} and ${bottomContestantId} at rank ${topRank}`
        );
      }

      const predictedWinnerId = topRank < bottomRank ? topContestantId : bottomContestantId;
      const predictedLoserId =
        predictedWinnerId === topContestantId ? bottomContestantId : topContestantId;

      games.push({
        slotId: slot.id,
        round,
        slotIndex: slot.slotIndex,
        region: slot.region,
        feedingSlotIds: [topSlotId, bottomSlotId],
        topContestantId,
        bottomContestantId,
        predictedWinnerId,
        predictedLoserId,
      });

      // Record the loser's predicted exit
      if (round === "CHAMPIONSHIP") {
        predictedExitRound[predictedLoserId] = "CHAMPIONSHIP_RUNNER_UP";
      } else {
        predictedExitRound[predictedLoserId] = round as PredictedExitRound;
      }

      // Winner advances into this slot
      occupantMap.set(slot.id, predictedWinnerId);
    }
  }

  // 4. Find the championship slot to identify the champion
  const champSlot = slots.find((s) => s.round === "CHAMPIONSHIP" && s.feedingSlotIds.length === 2);
  if (!champSlot) {
    throw new Error(`No championship slot found for gender ${gender}`);
  }
  const championId = occupantMap.get(champSlot.id);
  if (!championId) {
    throw new Error(`Championship slot ${champSlot.id} has no occupant after resolution`);
  }
  predictedExitRound[championId] = "CHAMPIONSHIP_WINNER";

  return { gender, games, predictedExitRound, championId, leafOccupants };
}

// ─── applyActualResults ────────────────────────────────────────────────────────

/**
 * After real game results are imported, update the resolved bracket for
 * reseed_by_ranking mode: replace eliminated predicted contestants with the
 * actual advancing team and re-evaluate the matchup winner by rank.
 *
 * Matchups where both predicted contestants are still alive are left unchanged.
 * Does NOT mutate the input resolved bracket.
 *
 * Only called for reseed_by_ranking competitions. For fixed mode, pass
 * originalBracket as currentBracket without calling this function.
 */
export function applyActualResults(
  resolved: ResolvedBracketData,
  actualResults: ActualResultItem[],
  rankMap: RankMap
): ResolvedBracketData {
  // 1. Build lookup maps from actual results
  const actualWinnerBySlotId = new Map<string, string>();
  const eliminatedSchoolIds = new Set<string>();
  for (const result of actualResults) {
    actualWinnerBySlotId.set(result.bracketSlotId, result.winningSchoolId);
    eliminatedSchoolIds.add(result.losingSchoolId);
  }

  // 2. Build currentOccupantMap: who actually occupies each slot right now
  //    Start from leaf positions, then follow actual results (or predicted winners
  //    for games not yet played).
  const currentOccupantMap = new Map<string, string>(Object.entries(resolved.leafOccupants));

  // Process in round order so upstream slots are resolved before downstream ones
  for (const game of resolved.games) {
    const actual = actualWinnerBySlotId.get(game.slotId);
    if (actual !== undefined) {
      currentOccupantMap.set(game.slotId, actual);
    } else {
      currentOccupantMap.set(game.slotId, game.predictedWinnerId);
    }
  }

  // 3. Deep-clone the resolved bracket
  const newGames: ResolvedGame[] = resolved.games.map((g) => ({ ...g }));
  const newPredictedExitRound: Record<string, PredictedExitRound> = {
    ...resolved.predictedExitRound,
  };

  // 4. Rebuild games, re-evaluating any matchup where a contestant changed
  //    We need a mutable occupant map as we process each game in order.
  const rebuildOccupantMap = new Map<string, string>(Object.entries(resolved.leafOccupants));

  for (let i = 0; i < newGames.length; i++) {
    const G = newGames[i];

    // Already-played games: copy actual result, no re-evaluation needed
    if (actualWinnerBySlotId.has(G.slotId)) {
      const winner = actualWinnerBySlotId.get(G.slotId)!;
      rebuildOccupantMap.set(G.slotId, winner);
      continue;
    }

    // Unplayed game: look up current contestants
    const topActual = rebuildOccupantMap.get(G.feedingSlotIds[0]);
    const bottomActual = rebuildOccupantMap.get(G.feedingSlotIds[1]);

    if (topActual === undefined || bottomActual === undefined) {
      // Upstream game not yet resolved — leave unchanged
      rebuildOccupantMap.set(G.slotId, G.predictedWinnerId);
      continue;
    }

    const changed = topActual !== G.topContestantId || bottomActual !== G.bottomContestantId;

    if (changed) {
      const topRank = rankMap[topActual];
      const bottomRank = rankMap[bottomActual];

      if (topRank === undefined || bottomRank === undefined) {
        // Replacement school not in rank map (shouldn't happen) — leave unchanged
        rebuildOccupantMap.set(G.slotId, G.predictedWinnerId);
        continue;
      }

      const newWinner = topRank < bottomRank ? topActual : bottomActual;
      const newLoser = newWinner === topActual ? bottomActual : topActual;

      newGames[i] = {
        ...G,
        topContestantId: topActual,
        bottomContestantId: bottomActual,
        predictedWinnerId: newWinner,
        predictedLoserId: newLoser,
      };
      rebuildOccupantMap.set(G.slotId, newWinner);
    } else {
      rebuildOccupantMap.set(G.slotId, G.predictedWinnerId);
    }
  }

  // 5. Rebuild predictedExitRound from the updated games
  for (const game of newGames) {
    if (game.round === "CHAMPIONSHIP") {
      newPredictedExitRound[game.predictedLoserId] = "CHAMPIONSHIP_RUNNER_UP";
      newPredictedExitRound[game.predictedWinnerId] = "CHAMPIONSHIP_WINNER";
    } else {
      newPredictedExitRound[game.predictedLoserId] = game.round as PredictedExitRound;
    }
  }

  // Championship winner
  const champGame = newGames.find((g) => g.round === "CHAMPIONSHIP");
  const newChampionId = champGame?.predictedWinnerId ?? resolved.championId;

  return {
    ...resolved,
    games: newGames,
    predictedExitRound: newPredictedExitRound,
    championId: newChampionId,
  };
}
