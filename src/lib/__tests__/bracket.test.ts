import { describe, it, expect } from "vitest";
import { resolveInitialBracket, applyActualResults } from "@/lib/bracket";
import {
  buildRankMap,
  buildMinimal4TeamSlots,
  buildMinimal8TeamSlotsWithFirstFour,
} from "./fixtures";
import type { ActualResultItem } from "@/types";

// ─── resolveInitialBracket ─────────────────────────────────────────────────────

describe("resolveInitialBracket", () => {
  it("resolves championship winner as the highest-ranked school", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]); // A = rank 1
    const result = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(result.championId).toBe("A");
  });

  it("resolves all games in correct round order", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const { games } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    // 4-team bracket: 2 FINAL_FOUR games then 1 CHAMPIONSHIP
    expect(games).toHaveLength(3);
    expect(games[0].round).toBe("FINAL_FOUR");
    expect(games[1].round).toBe("FINAL_FOUR");
    expect(games[2].round).toBe("CHAMPIONSHIP");
  });

  it("predictedExitRound[loser] equals the round they lose in", () => {
    const slots = buildMinimal4TeamSlots();
    // A=1, B=2, C=3, D=4 → A beats B in SF1, C beats D in SF2, A beats C in final
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const { predictedExitRound } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(predictedExitRound["B"]).toBe("FINAL_FOUR");
    expect(predictedExitRound["D"]).toBe("FINAL_FOUR");
  });

  it("championship runner-up gets CHAMPIONSHIP_RUNNER_UP exit", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]); // A beats C in final
    const { predictedExitRound } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(predictedExitRound["C"]).toBe("CHAMPIONSHIP_RUNNER_UP");
  });

  it("championship winner gets CHAMPIONSHIP_WINNER exit", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const { predictedExitRound } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(predictedExitRound["A"]).toBe("CHAMPIONSHIP_WINNER");
  });

  it("uses lower rank number as winner", () => {
    const slots = buildMinimal4TeamSlots();
    // Put lower-ranked schools as #1 to verify rank comparison direction
    const rankMap = buildRankMap(["D", "C", "B", "A"]); // D=1 (best), A=4
    const result = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(result.championId).toBe("D");
  });

  it("higher-seed correctly beats lower-seed regardless of slot order", () => {
    const slots = buildMinimal4TeamSlots();
    // B(2) and A(3) are in SF1 — B should win even though A is the "top" slot
    const rankMap = buildRankMap(["C", "B", "A", "D"]); // C=1, B=2, A=3, D=4
    const { games } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const sf1 = games.find((g) => g.slotId === "SF1")!;
    expect(sf1.predictedWinnerId).toBe("B"); // rank 2 beats rank 3
  });

  it("leafOccupants contains all initial seed positions", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const { leafOccupants } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(leafOccupants["LEAF_A"]).toBe("A");
    expect(leafOccupants["LEAF_B"]).toBe("B");
    expect(leafOccupants["LEAF_C"]).toBe("C");
    expect(leafOccupants["LEAF_D"]).toBe("D");
  });

  it("feedingSlotIds preserved on every ResolvedGame", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const { games } = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const sf1 = games.find((g) => g.slotId === "SF1")!;
    expect(sf1.feedingSlotIds).toEqual(["LEAF_A", "LEAF_B"]);
    const champ = games.find((g) => g.slotId === "CHAMP")!;
    expect(champ.feedingSlotIds).toEqual(["SF1", "SF2"]);
  });

  it("handles First Four: winner of play-in advances to next game", () => {
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    // FF1a(1) beats FF1b(2) → FF1a advances to E1 vs E1b(3)
    // FF2a(4) beats FF2b(5) → FF2a advances to E2 vs E2b(6)
    // FF1a(1) beats E1b(3) in E1; FF2a(4) beats E2b(6) in E2
    // FF1a(1) beats FF2a(4) in championship
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const result = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(result.championId).toBe("FF1a");
    // FF1a should have won the FF1 game
    const ff1Game = result.games.find((g) => g.slotId === "FF1")!;
    expect(ff1Game.predictedWinnerId).toBe("FF1a");
  });

  it("throws on unknown school in rankMap", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C"]); // D is missing
    expect(() =>
      resolveInitialBracket({ gender: "MENS", slots, rankMap }),
    ).toThrow(/School D not found in rank map/);
  });

  it("throws on malformed slot with 1 feedingSlotId", () => {
    const slots = buildMinimal4TeamSlots();
    // Corrupt one slot to have 1 feeding slot
    slots.push({
      id: "BAD",
      round: "CHAMPIONSHIP",
      slotIndex: 99,
      region: null,
      schoolId: null,
      nextSlotId: null,
      feedingSlotIds: ["SF1"],
    });
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    expect(() =>
      resolveInitialBracket({ gender: "MENS", slots, rankMap }),
    ).toThrow(/1 feeding slots; expected 0 or 2/);
  });

  it("deterministic output for same inputs", () => {
    const slots = buildMinimal4TeamSlots();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    const r1 = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const r2 = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    expect(r1).toEqual(r2);
  });
});

// ─── applyActualResults ────────────────────────────────────────────────────────

describe("applyActualResults", () => {
  function makeResolved() {
    const slots = buildMinimal4TeamSlots();
    // A=1, B=2, C=3, D=4
    // SF1: A beats B; SF2: C beats D; CHAMP: A beats C
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    return { resolved: resolveInitialBracket({ gender: "MENS", slots, rankMap }), rankMap };
  }

  it("returns structurally equal bracket when no actual results exist", () => {
    const { resolved, rankMap } = makeResolved();
    const updated = applyActualResults(resolved, [], rankMap);
    expect(updated.games).toEqual(resolved.games);
    expect(updated.championId).toBe(resolved.championId);
  });

  it("returns structurally equal bracket when all actual results match predictions", () => {
    const { resolved, rankMap } = makeResolved();
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1",   winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2",   winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    expect(updated.games).toEqual(resolved.games);
    expect(updated.championId).toBe("A");
  });

  it("replaces eliminated predicted winner in future game", () => {
    const { resolved, rankMap } = makeResolved();
    // B(rank 2) upsets A(rank 1) in SF1 → B advances to championship
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    const champ = updated.games.find((g) => g.slotId === "CHAMP")!;
    // Championship now has B vs predicted C (C is still alive)
    expect(champ.topContestantId).toBe("B");
    expect(champ.bottomContestantId).toBe("C");
  });

  it("re-evaluates predicted winner by rank after replacement", () => {
    const { resolved, rankMap } = makeResolved();
    // B(rank 2) upsets A(rank 1) in SF1 → B(rank 2) vs C(rank 3) in CHAMP → B wins
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    const champ = updated.games.find((g) => g.slotId === "CHAMP")!;
    expect(champ.predictedWinnerId).toBe("B"); // rank 2 beats rank 3
    expect(champ.predictedLoserId).toBe("C");
  });

  it("skips re-evaluation when both contestants are still alive", () => {
    const { resolved, rankMap } = makeResolved();
    // Only SF2 result: C beats D (matches prediction) → SF2 unchanged, SF1 untouched
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    const sf1 = updated.games.find((g) => g.slotId === "SF1")!;
    // SF1 not played yet, both A and B alive → unchanged
    expect(sf1.predictedWinnerId).toBe("A");
    expect(sf1.predictedLoserId).toBe("B");
  });

  it("cascading replacement across two rounds", () => {
    // 8-team bracket: FF1a(1) vs FF1b(2) in FIRST_FOUR, winner faces E1b(3) in ELITE_8
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const resolved = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    // FF1b(2) upsets FF1a(1) in First Four → FF1b advances to E1 vs E1b
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1b", losingSchoolId: "FF1a" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    const e1 = updated.games.find((g) => g.slotId === "E1")!;
    // FF1b replaced FF1a; FF1b(2) vs E1b(3) → FF1b wins
    expect(e1.topContestantId).toBe("FF1b");
    expect(e1.predictedWinnerId).toBe("FF1b");
  });

  it("championship runner-up and winner keys updated after replacement", () => {
    const { resolved, rankMap } = makeResolved();
    // D(rank 4) upsets C(rank 3) in SF2 → D advances; A vs D in CHAMP → A wins
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF2", winningSchoolId: "D", losingSchoolId: "C" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    expect(updated.predictedExitRound["A"]).toBe("CHAMPIONSHIP_WINNER");
    expect(updated.predictedExitRound["D"]).toBe("CHAMPIONSHIP_RUNNER_UP");
  });

  it("already-played games take their actual result winner", () => {
    const { resolved, rankMap } = makeResolved();
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    // SF1 was played; its game record should reflect the actual contestants
    const sf1 = updated.games.find((g) => g.slotId === "SF1")!;
    // Already-played games are copied as-is (original predicted contestants)
    expect(sf1.topContestantId).toBe("A");
    expect(sf1.bottomContestantId).toBe("B");
  });

  it("does not mutate the input resolved bracket", () => {
    const { resolved, rankMap } = makeResolved();
    const originalChampId = resolved.championId;
    const originalGames = JSON.stringify(resolved.games);
    applyActualResults(
      resolved,
      [{ bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" }],
      rankMap,
    );
    expect(resolved.championId).toBe(originalChampId);
    expect(JSON.stringify(resolved.games)).toBe(originalGames);
  });

  it("updates championId when actual results change the predicted champion", () => {
    const { resolved, rankMap } = makeResolved();
    // Full tournament: B upsets A in SF1, C beats D in SF2, B beats C in CHAMP
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1",   winningSchoolId: "B", losingSchoolId: "A" },
      { bracketSlotId: "SF2",   winningSchoolId: "C", losingSchoolId: "D" },
    ];
    const updated = applyActualResults(resolved, actualResults, rankMap);
    // CHAMP game: B(rank 2) vs C(rank 3) → B wins → championId = B
    expect(updated.championId).toBe("B");
  });
});

