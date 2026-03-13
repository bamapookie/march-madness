import type {
  BracketSlotInput,
  CompetitionSettings,
  RankMap,
} from "@/types";

// ─── RankMap helper ───────────────────────────────────────────────────────────

/** Build a RankMap from an ordered array of schoolIds (rank 1 = index 0). */
export function buildRankMap(schoolIds: string[]): RankMap {
  const map: RankMap = {};
  schoolIds.forEach((id, i) => {
    map[id] = i + 1;
  });
  return map;
}

// ─── Minimal 4-team bracket ───────────────────────────────────────────────────
//
//  LEAF_A ─┐
//           ├─► SF1 (FINAL_FOUR, slotIndex 0) ─┐
//  LEAF_B ─┘                                    ├─► CHAMP (CHAMPIONSHIP)
//  LEAF_C ─┐                                    │
//           ├─► SF2 (FINAL_FOUR, slotIndex 1) ─┘
//  LEAF_D ─┘

export function buildMinimal4TeamSlots(): BracketSlotInput[] {
  return [
    // Leaf slots
    { id: "LEAF_A", round: "FINAL_FOUR", slotIndex: 0, region: null, schoolId: "A", nextSlotId: "SF1", feedingSlotIds: [] },
    { id: "LEAF_B", round: "FINAL_FOUR", slotIndex: 1, region: null, schoolId: "B", nextSlotId: "SF1", feedingSlotIds: [] },
    { id: "LEAF_C", round: "FINAL_FOUR", slotIndex: 2, region: null, schoolId: "C", nextSlotId: "SF2", feedingSlotIds: [] },
    { id: "LEAF_D", round: "FINAL_FOUR", slotIndex: 3, region: null, schoolId: "D", nextSlotId: "SF2", feedingSlotIds: [] },
    // Game slots
    { id: "SF1",    round: "FINAL_FOUR",    slotIndex: 0, region: null, schoolId: null, nextSlotId: "CHAMP", feedingSlotIds: ["LEAF_A", "LEAF_B"] },
    { id: "SF2",    round: "FINAL_FOUR",    slotIndex: 1, region: null, schoolId: null, nextSlotId: "CHAMP", feedingSlotIds: ["LEAF_C", "LEAF_D"] },
    { id: "CHAMP",  round: "CHAMPIONSHIP",  slotIndex: 0, region: null, schoolId: null, nextSlotId: null,    feedingSlotIds: ["SF1", "SF2"] },
  ];
}

// ─── 8-team bracket with First Four ──────────────────────────────────────────
//
//  LEAF_FF1a ─┐
//              ├─► FF1 (FIRST_FOUR) ─┐
//  LEAF_FF1b ─┘                       ├─► E1 (ELITE_8, slotIndex 0) ─┐
//  LEAF_E1b  ─────────────────────────┘                                 ├─► CHAMP8 (CHAMPIONSHIP)
//                                                                        │
//  LEAF_FF2a ─┐                                                         │
//              ├─► FF2 (FIRST_FOUR) ─┐                                 │
//  LEAF_FF2b ─┘                       ├─► E2 (ELITE_8, slotIndex 1) ─┘
//  LEAF_E2b  ─────────────────────────┘

export function buildMinimal8TeamSlotsWithFirstFour(): BracketSlotInput[] {
  return [
    // First Four leaf slots
    { id: "LEAF_FF1a", round: "FIRST_FOUR",   slotIndex: 0, region: null, schoolId: "FF1a", nextSlotId: "FF1",    feedingSlotIds: [] },
    { id: "LEAF_FF1b", round: "FIRST_FOUR",   slotIndex: 1, region: null, schoolId: "FF1b", nextSlotId: "FF1",    feedingSlotIds: [] },
    { id: "LEAF_FF2a", round: "FIRST_FOUR",   slotIndex: 2, region: null, schoolId: "FF2a", nextSlotId: "FF2",    feedingSlotIds: [] },
    { id: "LEAF_FF2b", round: "FIRST_FOUR",   slotIndex: 3, region: null, schoolId: "FF2b", nextSlotId: "FF2",    feedingSlotIds: [] },
    // Direct seed leaves for Elite 8 slots
    { id: "LEAF_E1b",  round: "ELITE_8",      slotIndex: 1, region: null, schoolId: "E1b",  nextSlotId: "E1",     feedingSlotIds: [] },
    { id: "LEAF_E2b",  round: "ELITE_8",      slotIndex: 3, region: null, schoolId: "E2b",  nextSlotId: "E2",     feedingSlotIds: [] },
    // First Four game slots
    { id: "FF1",    round: "FIRST_FOUR",   slotIndex: 0, region: null, schoolId: null, nextSlotId: "E1",     feedingSlotIds: ["LEAF_FF1a", "LEAF_FF1b"] },
    { id: "FF2",    round: "FIRST_FOUR",   slotIndex: 1, region: null, schoolId: null, nextSlotId: "E2",     feedingSlotIds: ["LEAF_FF2a", "LEAF_FF2b"] },
    // Elite 8 game slots
    { id: "E1",     round: "ELITE_8",      slotIndex: 0, region: null, schoolId: null, nextSlotId: "CHAMP8", feedingSlotIds: ["FF1", "LEAF_E1b"] },
    { id: "E2",     round: "ELITE_8",      slotIndex: 1, region: null, schoolId: null, nextSlotId: "CHAMP8", feedingSlotIds: ["FF2", "LEAF_E2b"] },
    // Championship
    { id: "CHAMP8", round: "CHAMPIONSHIP", slotIndex: 0, region: null, schoolId: null, nextSlotId: null,     feedingSlotIds: ["E1", "E2"] },
  ];
}

// ─── Default competition settings ─────────────────────────────────────────────

export const defaultSettings: CompetitionSettings = {
  lock_mode: "before_first_four",
  scoring_mode: ["round_advancement", "correct_winner"],
  seeding_bonus_enabled: true,
  reseed_mode: "fixed",
  max_lists_per_user: 1,
  round_points:         { first_four: 1, round_of_64: 2, round_of_32: 4, sweet_16: 8,  elite_8: 16, final_four: 32, championship: 64  },
  correct_winner_points:{ first_four: 2, round_of_64: 4, round_of_32: 8, sweet_16: 16, elite_8: 32, final_four: 64, championship: 128 },
  seeding_bonus_points: { first_four: 1, round_of_64: 2, round_of_32: 4, sweet_16: 8,  elite_8: 16, final_four: 32, championship_runner_up: 64, championship_winner: 128 },
};


