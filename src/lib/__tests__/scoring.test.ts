import { describe, it, expect } from "vitest";
import { scoreEntry } from "@/lib/scoring";
import { resolveInitialBracket, applyActualResults } from "@/lib/bracket";
import {
  buildRankMap,
  buildMinimal4TeamSlots,
  buildMinimal8TeamSlotsWithFirstFour,
  defaultSettings,
} from "./fixtures";
import type {
  ActualResultItem,
  CompetitionSettings,
  GenderScoringInput,
  ResolvedBracketData,
  ScoringInput,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wrap a single-gender input into a full ScoringInput (mens and womens identical). */
function bothGenders(
  gi: GenderScoringInput,
  settings: CompetitionSettings = defaultSettings
): ScoringInput {
  return { mens: gi, womens: gi, settings };
}

/** Resolve the standard 4-team bracket (A=1, B=2, C=3, D=4). */
function resolve4Team(): ResolvedBracketData {
  return resolveInitialBracket({
    gender: "MENS",
    slots: buildMinimal4TeamSlots(),
    rankMap: buildRankMap(["A", "B", "C", "D"]),
  });
}

/** Make a GenderScoringInput with fixed mode (original == current). */
function fixedInput(
  bracket: ResolvedBracketData,
  actualResults: ActualResultItem[]
): GenderScoringInput {
  return { originalBracket: bracket, currentBracket: bracket, actualResults };
}

// ─── Correct Winner Scoring ───────────────────────────────────────────────────

describe("correct winner scoring", () => {
  it("awards correct_winner_points for each correctly picked game", () => {
    const bracket = resolve4Team();
    // SF1: A beats B (matches prediction)
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // correct_winner_points.final_four = 64, earned once per gender = 128 total
    expect(result.mensScore).toBe(64);
    expect(result.totalScore).toBe(128);
  });

  it("awards zero correct_winner_points for wrong pick", () => {
    const bracket = resolve4Team();
    // SF1: B upsets A (prediction was A)
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    expect(result.mensScore).toBe(0);
  });

  it("awards escalating points for correct picks in later rounds", () => {
    const bracket = resolve4Team();
    // Both semis and the final all go as predicted
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // final_four: 64 × 2 games + championship: 128 × 1 game = 256 per gender
    expect(result.mensScore).toBe(64 + 64 + 128);
    // Championship pick earns 128, final_four earns 64 → championship > semifinal ✓
  });

  it("fixed: eliminated team's future games earn zero", () => {
    const bracket = resolve4Team();
    // A is eliminated in SF1 → CHAMP (predicted A beats C) earns 0 CW points
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "B", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
      reseed_mode: "fixed",
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // Only SF2 correct (C beats D, prediction was C) → 64 per gender
    expect(result.mensScore).toBe(64);
  });

  it("reseed_by_ranking: correct pick of reseed winner earns points", async () => {
    const bracket = resolve4Team();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    // B upsets A in SF1 → reseed: CHAMP becomes B vs C, B(rank2) < C(rank3) → B predicted
    const sf1Upset: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
    ];
    const currentBracket = applyActualResults(bracket, sf1Upset, rankMap);
    // Now the full actual result: C beats D in SF2, B beats C in CHAMP
    const actual: ActualResultItem[] = [
      ...sf1Upset,
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "B", losingSchoolId: "C" },
    ];
    const gi: GenderScoringInput = {
      originalBracket: bracket,
      currentBracket,
      actualResults: actual,
    };
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
      reseed_mode: "reseed_by_ranking",
    };
    const result = scoreEntry(bothGenders(gi, settings));
    // currentBracket: SF2 predicted C, CHAMP predicted B → both correct
    // SF1 predicted A (from currentBracket for played games), actual B → SF1 wrong
    // SF2: 64, CHAMP: 128 → 192 per gender
    expect(result.mensScore).toBe(64 + 128);
  });
});

// ─── Round Advancement Scoring ────────────────────────────────────────────────

describe("round advancement scoring", () => {
  it("awards round_points cumulatively for each round won by original predicted winner", () => {
    // Use 8-team bracket so we have FIRST_FOUR + ELITE_8 + CHAMPIONSHIP rounds
    // Ranks: FF1a=1, FF1b=2, E1b=3, FF2a=4, FF2b=5, E2b=6
    // Predicted: FF1a wins FF1, FF1a beats E1b in E1, FF1a beats FF2a in CHAMP
    // FF2a wins FF2, FF2a beats E2b in E2
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });

    // All games go as predicted
    const actual: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1a", losingSchoolId: "FF1b" },
      { bracketSlotId: "FF2", winningSchoolId: "FF2a", losingSchoolId: "FF2b" },
      { bracketSlotId: "E1", winningSchoolId: "FF1a", losingSchoolId: "E1b" },
      { bracketSlotId: "E2", winningSchoolId: "FF2a", losingSchoolId: "E2b" },
      { bracketSlotId: "CHAMP8", winningSchoolId: "FF1a", losingSchoolId: "FF2a" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
    };
    const gi = fixedInput(bracket, actual);
    const result = scoreEntry(bothGenders(gi, settings));
    // FF1a was predicted to WIN: FF1(first_four=1), E1(elite_8=16), CHAMP8(championship=64)
    // FF2a was predicted to WIN: FF2(first_four=1), E2(elite_8=16)
    // FF2a was predicted to LOSE championship → no championship RA for FF2a
    // Total RA per gender: 1 + 16 + 64 + 1 + 16 = 98
    expect(result.mensScore).toBe(1 + 16 + 64 + 1 + 16);
  });

  it("awards no round_points for rounds the original predicted winner does not reach", () => {
    const bracket = resolve4Team();
    // B(rank2) upsets A(rank1) in SF1. A was predicted to reach CHAMP.
    // A only wins 0 games → A earns 0 RA points
    // B was predicted to lose in SF1 → B is predicted loser → no RA for B in SF1
    // C beats D in SF2 (predicted), C earns FINAL_FOUR RA points
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // Only C earns RA: C was predicted winner of SF2 (FINAL_FOUR) → 32 per gender
    expect(result.mensScore).toBe(32);
  });

  it("does NOT award round_points to reseeded replacement teams", async () => {
    const bracket = resolve4Team();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    // B upsets A; in reseed mode B now plays C in CHAMP
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "B", losingSchoolId: "C" },
    ];
    const currentBracket = applyActualResults(bracket, actualResults, rankMap);
    const gi: GenderScoringInput = {
      originalBracket: bracket,
      currentBracket,
      actualResults,
    };
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
      reseed_mode: "reseed_by_ranking",
    };
    const result = scoreEntry(bothGenders(gi, settings));
    // B replaced A in CHAMP. B earns NO RA for CHAMP since original predicted winner
    // of CHAMP was A, not B. B earns no RA at all (was predicted to lose SF1).
    // A earns no RA (never won any game).
    // C earns FINAL_FOUR(32) RA (C won SF2, was predicted to win SF2).
    // No championship RA (A was predicted winner of CHAMP, but didn't win).
    expect(result.mensScore).toBe(32);
  });

  it("first_four points awarded when lock_mode is before_first_four", () => {
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const actual: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1a", losingSchoolId: "FF1b" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
      lock_mode: "before_first_four",
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // FF1a won FF1, was predicted to win → round_points.first_four = 1 per gender
    expect(result.mensScore).toBe(1);
  });

  it("winning a ROUND_OF_64 game earns round_of_64 key (1:1 mapping, same as correctWinnerKey)", () => {
    // Build a minimal bracket that includes a ROUND_OF_64 game
    const slots = [
      {
        id: "L1",
        round: "ROUND_OF_64" as const,
        slotIndex: 0,
        region: null,
        schoolId: "X",
        nextSlotId: "G1",
        feedingSlotIds: [],
      },
      {
        id: "L2",
        round: "ROUND_OF_64" as const,
        slotIndex: 1,
        region: null,
        schoolId: "Y",
        nextSlotId: "G1",
        feedingSlotIds: [],
      },
      {
        id: "G1",
        round: "ROUND_OF_64" as const,
        slotIndex: 0,
        region: null,
        schoolId: null,
        nextSlotId: "CHAMP_R",
        feedingSlotIds: ["L1", "L2"],
      },
      {
        id: "L3",
        round: "CHAMPIONSHIP" as const,
        slotIndex: 0,
        region: null,
        schoolId: "Z",
        nextSlotId: "CHAMP_R",
        feedingSlotIds: [],
      },
      {
        id: "CHAMP_R",
        round: "CHAMPIONSHIP" as const,
        slotIndex: 0,
        region: null,
        schoolId: null,
        nextSlotId: null,
        feedingSlotIds: ["G1", "L3"],
      },
    ];
    const rankMap = buildRankMap(["X", "Y", "Z"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const actual: ActualResultItem[] = [
      { bracketSlotId: "G1", winningSchoolId: "X", losingSchoolId: "Y" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
      round_points: { ...defaultSettings.round_points, round_of_64: 7 },
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // X wins R64 game, was predicted to win → 7 points (round_of_64 key)
    expect(result.mensScore).toBe(7);
  });

  it("champion earns round_points for every game won, including championship", () => {
    const bracket = resolve4Team();
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["round_advancement"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // A: wins SF1(FINAL_FOUR=32) + CHAMP(CHAMPIONSHIP=64) = 96
    // C: wins SF2(FINAL_FOUR=32), was predicted to lose CHAMP → no CHAMP RA for C
    // Total: 96 + 32 = 128 per gender
    expect(result.mensScore).toBe(32 + 64 + 32);
  });
});

// ─── Seeding Accuracy Bonus ───────────────────────────────────────────────────

describe("seeding accuracy bonus", () => {
  it("awards seeding_bonus when actual exit matches predicted exit exactly", () => {
    const bracket = resolve4Team();
    // B predicted to exit FINAL_FOUR; B actually loses in SF1 (FINAL_FOUR)
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // seeding_bonus_points.final_four = 32 for B per gender
    expect(result.mensScore).toBe(32);
  });

  it("no bonus when team exits one round earlier than predicted", () => {
    const bracket = resolve4Team();
    // A predicted CHAMPIONSHIP_WINNER; D predicted FINAL_FOUR exit
    // A exits FINAL_FOUR (one round earlier than CHAMPIONSHIP_WINNER) → 0 bonus
    // D exits FINAL_FOUR exactly as predicted → 32 bonus
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" }, // A exits FINAL_FOUR early
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" }, // D exits FINAL_FOUR on prediction
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // Only D earns a bonus (exits exactly as predicted)
    expect(result.mensScore).toBe(32);
  });

  it("no bonus when team advances past predicted exit", () => {
    const bracket = resolve4Team();
    // D predicted to exit FINAL_FOUR; D upsets C in SF2 and wins → exits later
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "D", losingSchoolId: "C" }, // D advances past prediction
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // B exited FINAL_FOUR (predicted FINAL_FOUR) → 32 bonus
    // C exited FINAL_FOUR (predicted CHAMPIONSHIP_RUNNER_UP) → 0 bonus
    // D still alive → 0 bonus
    expect(result.mensScore).toBe(32);
  });

  it("championship_winner bonus awarded only to actual champion", () => {
    const bracket = resolve4Team();
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // A: CHAMPIONSHIP_WINNER predicted + actual → 128
    // B: FINAL_FOUR predicted + actual → 32
    // C: CHAMPIONSHIP_RUNNER_UP predicted + actual → 64
    // D: FINAL_FOUR predicted + actual → 32
    expect(result.mensScore).toBe(128 + 32 + 64 + 32);
  });

  it("championship_runner_up bonus awarded only to actual runner-up", () => {
    const bracket = resolve4Team();
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // C predicted CHAMPIONSHIP_RUNNER_UP, actually loses in CHAMP → 64 bonus
    expect(result.breakdown.mens.seedingBonus).toBe(128 + 32 + 64 + 32);
    // Verify C's contribution specifically by removing other bonuses
    const onlyC: CompetitionSettings = {
      ...settings,
      seeding_bonus_points: { ...defaultSettings.seeding_bonus_points, championship_runner_up: 77 },
    };
    const r2 = scoreEntry(bothGenders(fixedInput(bracket, actual), onlyC));
    // championship_winner: 128, final_four × 2: 32, championship_runner_up: 77
    expect(r2.breakdown.mens.seedingBonus).toBe(128 + 32 + 77 + 32);
  });

  it("championship_winner predicted but team loses in E8 → zero bonus", () => {
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    // FF1a predicted to win championship, but loses in E1
    const actual: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1a", losingSchoolId: "FF1b" },
      { bracketSlotId: "E1", winningSchoolId: "E1b", losingSchoolId: "FF1a" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // FF1a predicted CHAMPIONSHIP_WINNER but exited ELITE_8 → 0 bonus for FF1a
    // FF1b predicted FIRST_FOUR exit, actually exits FIRST_FOUR → bonus 1
    expect(result.breakdown.mens.seedingBonus).toBe(1);
  });

  it("seeding_bonus disabled: no bonus points awarded", () => {
    const bracket = resolve4Team();
    const actual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    expect(result.mensScore).toBe(0);
    expect(result.breakdown.mens.seedingBonus).toBe(0);
  });

  it("seeding bonus uses originalBracket, not currentBracket", async () => {
    const bracket = resolve4Team();
    const rankMap = buildRankMap(["A", "B", "C", "D"]);
    // B replaces A in championship (A is eliminated by B in SF1)
    const actualResults: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "B", losingSchoolId: "A" },
      { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
      { bracketSlotId: "CHAMP", winningSchoolId: "B", losingSchoolId: "C" },
    ];
    const currentBracket = applyActualResults(bracket, actualResults, rankMap);
    const gi: GenderScoringInput = {
      originalBracket: bracket,
      currentBracket,
      actualResults,
    };
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: true,
      reseed_mode: "reseed_by_ranking",
    };
    const result = scoreEntry(bothGenders(gi, settings));
    // B's original predicted exit was FINAL_FOUR (predicted to lose SF1 to A).
    // B actually loses in CHAMP (as runner-up). FINAL_FOUR ≠ CHAMPIONSHIP_RUNNER_UP → 0 bonus for B.
    // A's original predicted exit was CHAMPIONSHIP_WINNER. A actually exits FINAL_FOUR → 0 bonus.
    // C's original predicted exit was CHAMPIONSHIP_RUNNER_UP. C actually exits CHAMPIONSHIP (runner-up) → 64 bonus.
    // D's original predicted exit was FINAL_FOUR. D actually exits FINAL_FOUR (loses SF2) → 32 bonus.
    expect(result.breakdown.mens.seedingBonus).toBe(64 + 32);
  });
});

// ─── Lock Mode Guard ──────────────────────────────────────────────────────────

describe("lock mode guard", () => {
  it("before_round_of_64: First Four games earn zero in all scoring modes", () => {
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const actual: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1a", losingSchoolId: "FF1b" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      lock_mode: "before_round_of_64",
      seeding_bonus_enabled: true,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    expect(result.mensScore).toBe(0);
    expect(result.breakdown.mens.correctWinner).toBe(0);
    expect(result.breakdown.mens.roundAdvancement).toBe(0);
    expect(result.breakdown.mens.seedingBonus).toBe(0);
  });

  it("before_first_four: First Four games earn non-zero points", () => {
    const slots = buildMinimal8TeamSlotsWithFirstFour();
    const rankMap = buildRankMap(["FF1a", "FF1b", "E1b", "FF2a", "FF2b", "E2b"]);
    const bracket = resolveInitialBracket({ gender: "MENS", slots, rankMap });
    const actual: ActualResultItem[] = [
      { bracketSlotId: "FF1", winningSchoolId: "FF1a", losingSchoolId: "FF1b" },
    ];
    const settings: CompetitionSettings = {
      ...defaultSettings,
      lock_mode: "before_first_four",
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry(bothGenders(fixedInput(bracket, actual), settings));
    // CW: first_four = 2, RA: first_four = 1 → 3 per gender
    expect(result.mensScore).toBe(3);
  });
});

// ─── Combined Scoring and Tiebreaker ─────────────────────────────────────────

describe("combined scoring and tiebreaker", () => {
  const bracket = resolve4Team();
  const allCorrect: ActualResultItem[] = [
    { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
    { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
    { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
  ];

  it("totalScore equals mensScore + womensScore", () => {
    const mensGI = fixedInput(bracket, allCorrect);
    // Different womens bracket (just use the same for simplicity, the math still holds)
    const womensGI = fixedInput(
      resolveInitialBracket({
        gender: "WOMENS",
        slots: buildMinimal4TeamSlots(),
        rankMap: buildRankMap(["B", "A", "C", "D"]),
      }),
      [
        { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
        { bracketSlotId: "SF2", winningSchoolId: "C", losingSchoolId: "D" },
        { bracketSlotId: "CHAMP", winningSchoolId: "A", losingSchoolId: "C" },
      ]
    );
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const result = scoreEntry({ mens: mensGI, womens: womensGI, settings });
    expect(result.totalScore).toBe(result.mensScore + result.womensScore);
  });

  it("tiebreaker equals Math.abs(mensScore - womensScore)", () => {
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const mensGI = fixedInput(bracket, allCorrect);
    // Womens: only one game correct
    const womensGI = fixedInput(
      resolveInitialBracket({
        gender: "WOMENS",
        slots: buildMinimal4TeamSlots(),
        rankMap: buildRankMap(["A", "B", "C", "D"]),
      }),
      [{ bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" }]
    );
    const result = scoreEntry({ mens: mensGI, womens: womensGI, settings });
    expect(result.tiebreaker).toBe(Math.abs(result.mensScore - result.womensScore));
  });

  it("balanced scores produce lower tiebreaker than unbalanced", () => {
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: ["correct_winner"],
      seeding_bonus_enabled: false,
    };
    const gi = fixedInput(bracket, allCorrect);
    const balanced = scoreEntry({ mens: gi, womens: gi, settings });
    const partialActual: ActualResultItem[] = [
      { bracketSlotId: "SF1", winningSchoolId: "A", losingSchoolId: "B" },
    ];
    const womensPartial = fixedInput(
      resolveInitialBracket({
        gender: "WOMENS",
        slots: buildMinimal4TeamSlots(),
        rankMap: buildRankMap(["A", "B", "C", "D"]),
      }),
      partialActual
    );
    const unbalanced = scoreEntry({ mens: gi, womens: womensPartial, settings });
    expect(balanced.tiebreaker).toBeLessThan(unbalanced.tiebreaker);
  });

  it("empty actualResults produces zero scores", () => {
    const gi = fixedInput(bracket, []);
    const result = scoreEntry(bothGenders(gi));
    expect(result.totalScore).toBe(0);
    expect(result.tiebreaker).toBe(0);
  });

  it("scoring_mode = [] produces zero scores", () => {
    const settings: CompetitionSettings = {
      ...defaultSettings,
      scoring_mode: [],
      seeding_bonus_enabled: false,
    };
    const gi = fixedInput(bracket, allCorrect);
    const result = scoreEntry(bothGenders(gi, settings));
    expect(result.mensScore).toBe(0);
    expect(result.womensScore).toBe(0);
  });

  it("breakdown.mens.total + breakdown.womens.total equals totalScore", () => {
    const gi = fixedInput(bracket, allCorrect);
    const result = scoreEntry(bothGenders(gi));
    expect(result.breakdown.mens.total + result.breakdown.womens.total).toBe(result.totalScore);
  });
});
