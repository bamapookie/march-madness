# Milestone 0.3.0 — Core Domain Logic: Technical Design

## 1. Overview

Milestone 0.3.0 delivers two pure TypeScript modules and their unit test suites:

| File | Responsibility |
|---|---|
| `src/lib/bracket.ts` | Resolve a user's ranking list into Men's and Women's bracket predictions; apply real-world results to update predictions (reseed-by-ranking mode) |
| `src/lib/scoring.ts` | Compute a combined score from the resolved bracket vs. actual results for any competition settings configuration |
| `src/lib/__tests__/bracket.test.ts` | Unit tests for bracket.ts |
| `src/lib/__tests__/scoring.test.ts` | Unit tests for scoring.ts |

**Why pure / no-DB?** These functions operate entirely on plain JavaScript objects. They accept inputs that the DB layer assembles and return outputs that the DB layer persists. This isolation makes them fast to test, trivial to reason about, and usable in any future context (background jobs, preview APIs, etc.).

The functions are deliberately *not* aware of Prisma, `fetch`, or any async I/O. All DB-to-pure-type mapping happens in the API route or the cron handler that *calls* these functions (milestones 0.4+ and 0.6).

---

## 2. Testing Framework Setup

**No test runner is currently installed.** The project uses `tsx` for scripts and TypeScript directly. Recommend **Vitest** because:
- Zero Babel config required (uses esbuild/Rollup natively)
- Identical `describe`/`it`/`expect` API to Jest
- First-class TypeScript support
- Compatible with Next.js App Router (no DOM emulation needed for pure logic)

### Installation

```bash
npm install --save-dev vitest @vitest/coverage-v8
```

### `vitest.config.ts` (create at project root)

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/bracket.ts", "src/lib/scoring.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### `package.json` scripts to add

```json
"test":          "vitest run",
"test:watch":    "vitest",
"test:coverage": "vitest run --coverage"
```

---

## 3. File Structure

```
src/
  lib/
    bracket.ts              ← new (pure functions only; no Prisma imports)
    scoring.ts              ← new (pure functions only; no Prisma imports)
    ranking.ts              ← existing; untouched
    auth.ts                 ← existing; untouched
    db.ts                   ← existing; untouched
    __tests__/
      bracket.test.ts       ← new
      scoring.test.ts       ← new
  types/
    index.ts                ← add new types (see §4)
```

---

## 4. Type Definitions

All public input/output types belong in `src/types/index.ts`. Internal intermediate types (used only inside a single lib file) may be declared locally.

### 4.1 Types to add to `src/types/index.ts`

#### `Round` and `Gender` re-export aliases (avoid importing from generated Prisma in pure functions)

```typescript
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
```

*(These mirror the Prisma-generated `Round` and `Gender` enums. The alias removes the dependency on generated code from pure lib files.)*

---

#### `PredictedExitRound`

```typescript
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
  | "CHAMPIONSHIP_RUNNER_UP"  // predicted to lose in the championship game
  | "CHAMPIONSHIP_WINNER";    // predicted to win the championship
```

---

#### `RankMap`

```typescript
/** Maps schoolId → rank position (1 = highest-ranked; lower is better). */
export type RankMap = Record<string, number>;
```

---

#### `BracketSlotInput`

```typescript
/**
 * A flattened representation of one BracketSlot DB row,
 * suitable for passing to pure bracket functions.
 *
 * SLOT SEMANTICS (important for algorithm design):
 *   • Leaf slots  (feedingSlotIds.length === 0, schoolId set):
 *       A team's starting position. No game is played here; the slot's
 *       occupant is the seeded school.
 *   • Game slots  (feedingSlotIds.length === 2):
 *       A game between the occupants of the two feeding slots.
 *       The winner becomes this slot's occupant and advances to nextSlotId.
 *   • The `round` field names the round in which this slot's GAME is played
 *       (FIRST_FOUR, ROUND_OF_64, …, CHAMPIONSHIP).
 */
export type BracketSlotInput = {
  id: string;
  round: Round;
  slotIndex: number;
  region: string | null;
  schoolId: string | null;      // set for leaf slots (directly seeded teams)
  nextSlotId: string | null;    // null only for the Championship slot
  feedingSlotIds: string[];     // exactly 0 (leaf) or 2 (game)
};
```

---

#### `ResolvedGame`

```typescript
/**
 * One resolved game slot in a predicted bracket.
 * Represents a game between topContestantId and bottomContestantId,
 * with the winner advancing to nextSlotId.
 */
export type ResolvedGame = {
  slotId: string;
  round: Round;
  slotIndex: number;
  region: string | null;
  feedingSlotIds: [string, string];   // preserves slot tree structure for applyActualResults
  /** Occupant of feedingSlotIds[0] (the "top" path through the bracket). */
  topContestantId: string;
  /** Occupant of feedingSlotIds[1] (the "bottom" path). */
  bottomContestantId: string;
  /** The contestant with the lower rank number (= higher-ranked school). */
  predictedWinnerId: string;
  /** The contestant with the higher rank number. */
  predictedLoserId: string;
};
```

---

#### `ResolvedBracketData`

```typescript
/**
 * A fully resolved bracket for one gender.
 * This is the shape stored as JSON in ResolvedBracket.mensJson / womensJson.
 */
export type ResolvedBracketData = {
  gender: Gender;
  /**
   * All games, ordered by round (FIRST_FOUR first, CHAMPIONSHIP last).
   * Only game slots are included; leaf/starting-position slots are not listed here.
   */
  games: ResolvedGame[];
  /**
   * Maps schoolId → the round in which that school is predicted to exit.
   * Every school in the ranking list for this gender appears here.
   * The champion maps to "CHAMPIONSHIP_WINNER";
   * the runner-up maps to "CHAMPIONSHIP_RUNNER_UP".
   */
  predictedExitRound: Record<string, PredictedExitRound>;
  /** SchoolId of the predicted tournament champion. */
  championId: string;
  /**
   * Maps slotId → schoolId for all leaf slots (starting positions).
   * Needed by applyActualResults to trace actual advancing teams.
   */
  leafOccupants: Record<string, string>;
};
```

---

#### `BracketResolutionInput`

```typescript
/** Input to resolveInitialBracket. */
export type BracketResolutionInput = {
  gender: Gender;
  /** All BracketSlot rows for this season and gender, flattened to BracketSlotInput. */
  slots: BracketSlotInput[];
  /**
   * Maps schoolId → rank position from the user's RankingEntry rows.
   * All schools in the bracket must have an entry.
   */
  rankMap: RankMap;
};
```

---

#### `ActualResultItem`

```typescript
/** One imported game result, mapping to one TournamentResult DB row. */
export type ActualResultItem = {
  /** The bracket slot ID this game was played in (TournamentResult.bracketSlotId). */
  bracketSlotId: string;
  winningSchoolId: string;
  losingSchoolId: string;
};
```

---

#### Scoring types

```typescript
/** Input for one gender's scoring. */
export type GenderScoringInput = {
  /**
   * The original resolved bracket (from resolveInitialBracket).
   * Used for: round advancement, seeding accuracy bonus.
   * Never modified — reflects the user's original predictions.
   */
  originalBracket: ResolvedBracketData;
  /**
   * The current resolved bracket after applying real results.
   * For fixed mode: identical to originalBracket (pass the same object).
   * For reseed_by_ranking mode: the output of applyActualResults.
   * Used for: correct winner scoring.
   */
  currentBracket: ResolvedBracketData;
  /** All actual game results imported so far for this gender. */
  actualResults: ActualResultItem[];
};

/** Full input to scoreEntry. */
export type ScoringInput = {
  mens: GenderScoringInput;
  womens: GenderScoringInput;
  settings: CompetitionSettings;
};

/** Per-gender score breakdown (for display / debugging). */
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
```

---

## 5. `src/lib/bracket.ts` Design

### 5.1 Exports

```typescript
export function resolveInitialBracket(input: BracketResolutionInput): ResolvedBracketData
export function applyActualResults(
  resolved: ResolvedBracketData,
  actualResults: ActualResultItem[],
  rankMap: RankMap,
): ResolvedBracketData
```

Neither function is async. Neither imports from `@/lib/db` or `@/generated/prisma`.

---

### 5.2 `resolveInitialBracket`

**Purpose:** Walk the bracket slot tree bottom-up, determining a predicted winner for every game using the user's rank map. Return a fully populated `ResolvedBracketData`.

#### Internal data structures

```typescript
// slotMap: fast lookup by id
const slotMap = new Map<string, BracketSlotInput>(slots.map(s => [s.id, s]));

// occupantMap: slotId → the school currently occupying that slot
// (initialised with leaf slots; filled in as each round is processed)
const occupantMap = new Map<string, string>();

// Mutable output
const games: ResolvedGame[] = [];
const predictedExitRound: Record<string, PredictedExitRound> = {};
const leafOccupants: Record<string, string> = {};
```

#### Algorithm

```
1. Seed occupantMap with all leaf slots:
     for each slot where feedingSlotIds.length === 0:
       assert slot.schoolId !== null
       occupantMap.set(slot.id, slot.schoolId)
       leafOccupants[slot.id] = slot.schoolId

2. Define ROUND_ORDER = [FIRST_FOUR, ROUND_OF_64, ROUND_OF_32, SWEET_16, ELITE_8, FINAL_FOUR, CHAMPIONSHIP]

3. For each round R in ROUND_ORDER:
     Find all slots at round R that have feedingSlotIds.length === 2.
     For each such slot (sorted by slotIndex for determinism):

       topContestantId    = occupantMap.get(feedingSlotIds[0])  ← must exist
       bottomContestantId = occupantMap.get(feedingSlotIds[1])  ← must exist

       topRank    = rankMap[topContestantId]
       bottomRank = rankMap[bottomContestantId]

       winner = topRank < bottomRank ? topContestantId : bottomContestantId
       loser  = winner === topContestantId ? bottomContestantId : topContestantId

       // Record the game
       games.push({
         slotId: slot.id, round: R, slotIndex: slot.slotIndex, region: slot.region,
         feedingSlotIds: [feedingSlotIds[0], feedingSlotIds[1]],
         topContestantId, bottomContestantId,
         predictedWinnerId: winner, predictedLoserId: loser
       })

       // Record the loser's predicted exit round
       if R === CHAMPIONSHIP:
         predictedExitRound[loser] = "CHAMPIONSHIP_RUNNER_UP"
       else:
         predictedExitRound[loser] = R        // e.g. "ROUND_OF_64", "SWEET_16", …

       // Winner advances
       occupantMap.set(slot.id, winner)

4. After all rounds, the champion is occupantMap.get(championshipSlot.id)
   predictedExitRound[champion] = "CHAMPIONSHIP_WINNER"

5. Return { gender, games, predictedExitRound, championId: champion, leafOccupants }
```

#### Error cases

- **Rank tie** (two schools at the same rank): cannot happen given `@@unique([rankingListId, rank])` DB constraint, but guard defensively — throw `Error("Rank tie between ${id1} and ${id2} at rank ${rank}")`.
- **School missing from rankMap**: throw `Error("School ${id} not found in rank map")`.
- **No Championship slot found**: throw `Error("No championship slot found for gender ${gender}")`.
- **Slot with 1 feedingSlotId** (malformed data): throw `Error("Slot ${id} has ${n} feeding slots; expected 0 or 2")`.
- **Occupant not found for a feeding slot**: throw `Error("No occupant found for slot ${id} — possible missing round in bracket data")`.

---

### 5.3 `applyActualResults`

**Purpose:** After real game results are imported, scan all *unplayed* games in the resolved bracket. For any game where one or both predicted contestants have been eliminated in reality, replace them with the actual advancing team and re-evaluate the predicted winner by rank. Matchups where both predicted contestants are still alive are left unchanged.

This function is only called in **`reseed_by_ranking`** mode. For `fixed` mode, callers pass `originalBracket` as `currentBracket` without calling this function.

#### Algorithm

```
1. Build actualWinnerBySlotId: Map<slotId, schoolId>
     for each result in actualResults:
       actualWinnerBySlotId.set(result.bracketSlotId, result.winningSchoolId)

2. Build eliminatedSchoolIds: Set<schoolId>
     for each result in actualResults:
       eliminatedSchoolIds.add(result.losingSchoolId)

3. Build currentOccupantMap: Map<slotId, schoolId>
     — seed from resolved.leafOccupants (leaf starting positions)
     — for each game in resolved.games (in ROUND_ORDER):
         if actualWinnerBySlotId.has(game.slotId):
           currentOccupantMap.set(game.slotId, actualWinnerBySlotId.get(game.slotId))
         else:
           currentOccupantMap.set(game.slotId, game.predictedWinnerId)

4. Deep-clone the resolved bracket to newBracket (avoid mutating input).

5. Rebuild newBracket.games in ROUND_ORDER:
   For each game G (processed in ROUND_ORDER):

     a. If actualWinnerBySlotId.has(G.slotId):
          — This game already happened in reality. Copy as-is.
          — Continue to next game.

     b. (Game is not yet played in reality.)
          topActual    = currentOccupantMap.get(G.feedingSlotIds[0])
          bottomActual = currentOccupantMap.get(G.feedingSlotIds[1])

          changed = (topActual !== G.topContestantId) || (bottomActual !== G.bottomContestantId)

          if changed:
            topRank    = rankMap[topActual]
            bottomRank = rankMap[bottomActual]
            newWinner  = topRank < bottomRank ? topActual : bottomActual
            newLoser   = the other one
            update game: topContestantId = topActual, bottomContestantId = bottomActual,
                         predictedWinnerId = newWinner, predictedLoserId = newLoser
            currentOccupantMap.set(G.slotId, newWinner)
          else:
            // Both original contestants still alive — leave unchanged
            currentOccupantMap.set(G.slotId, G.predictedWinnerId)

6. Rebuild newBracket.predictedExitRound from the updated games:
     — For each updated game G:
         if G.round === CHAMPIONSHIP:
           predictedExitRound[G.predictedLoserId] = "CHAMPIONSHIP_RUNNER_UP"
           predictedExitRound[G.predictedWinnerId] = "CHAMPIONSHIP_WINNER"
         else:
           predictedExitRound[G.predictedLoserId] = G.round
     — Update newBracket.championId to the winner of the Championship game.

7. Return newBracket.
```

---

## 6. `src/lib/scoring.ts` Design

### 6.1 Exports

```typescript
export function scoreEntry(input: ScoringInput): ScoreResult
```

### 6.2 Internal helpers (not exported)

```typescript
/**
 * For round advancement scoring: maps the game's slot round to the
 * RoundPointMap key earned by the winner.
 *
 * KEY SEMANTIC: round_points.X means "points for WINNING a game in round X."
 * This is a direct 1:1 mapping identical to correctWinnerKey — the two functions
 * exist separately because they index different point maps (round_points vs.
 * correct_winner_points) and carry different semantic intent.
 *
 *   Winning a FIRST_FOUR game  → "first_four" points
 *   Winning a ROUND_OF_64 game → "round_of_64" points
 *   Winning a ROUND_OF_32 game → "round_of_32" points
 *   Winning a SWEET_16 game    → "sweet_16" points
 *   Winning an ELITE_8 game    → "elite_8" points
 *   Winning a FINAL_FOUR game  → "final_four" points
 *   Winning the CHAMPIONSHIP   → "championship" points
 *                                (only earned by the originally-predicted champion
 *                                 if they actually win; the runner-up was predicted
 *                                 to LOSE this game so earns no RA championship points)
 */
function roundAdvancementKey(round: Round): keyof RoundPointMap

/**
 * For correct winner scoring: maps the game's slot round to the
 * correct_winner_points key. Direct 1:1 mapping (FIRST_FOUR → "first_four", etc.)
 */
function correctWinnerKey(round: Round): keyof RoundPointMap

/**
 * Maps a PredictedExitRound to the seeding_bonus_points key.
 */
function predictedExitToSeedingBonusKey(exit: PredictedExitRound): keyof SeedingBonusPointMap

/**
 * Returns true if this game should be excluded from scoring
 * because lock_mode = "before_round_of_64" and the game is a First Four game.
 */
function isExcludedByLockMode(round: Round, lockMode: CompetitionSettings["lock_mode"]): boolean

/**
 * Determines the actual exit round for a school from the real results.
 * Returns null if the school hasn't been eliminated yet (still alive or tournament incomplete).
 */
function computeActualExit(
  schoolId: string,
  actualResultBySlotId: Map<string, ActualResultItem>,
  games: ResolvedGame[],
): PredictedExitRound | null

/** Score one gender's bracket against actual results. */
function scoreGender(input: GenderScoringInput, settings: CompetitionSettings): ScoreBreakdown
```

---

### 6.3 `roundAdvancementKey` mapping

| `game.round` (game played) | `round_points` key earned by winner |
|---|---|
| `FIRST_FOUR` | `"first_four"` |
| `ROUND_OF_64` | `"round_of_64"` |
| `ROUND_OF_32` | `"round_of_32"` |
| `SWEET_16` | `"sweet_16"` |
| `ELITE_8` | `"elite_8"` |
| `FINAL_FOUR` | `"final_four"` |
| `CHAMPIONSHIP` | `"championship"` |

> This is a direct 1:1 mapping, identical to `correctWinnerKey`. The distinction between the two functions is purely in which point map they are used with (`round_points` vs. `correct_winner_points`) and the condition under which they award points (original predicted winner vs. current predicted winner).

---

### 6.4 `scoreGender` algorithm

```
Inputs: originalBracket, currentBracket, actualResults, settings

Build actualResultBySlotId: Map<slotId, ActualResultItem>
  for each result: actualResultBySlotId.set(result.bracketSlotId, result)

roundAdvancement = 0
correctWinner    = 0
seedingBonus     = 0

─── PER-GAME SCORING ───────────────────────────────────────────────────────

For each game G in currentBracket.games:
  result = actualResultBySlotId.get(G.slotId)
  if result is null: skip  (game not played yet)

  if isExcludedByLockMode(G.round, settings.lock_mode): skip

  // ── CORRECT WINNER ──────────────────────────────────────────────────────
  // Uses currentBracket (which has reseeded predictions for reseed_by_ranking mode)
  if settings.scoring_mode.includes("correct_winner"):
    key = correctWinnerKey(G.round)
    if G.predictedWinnerId === result.winningSchoolId:
      correctWinner += settings.correct_winner_points[key]

  // ── ROUND ADVANCEMENT ───────────────────────────────────────────────────
  // Uses originalBracket ONLY. Points only if the originally-predicted winner
  // of this game slot actually won in reality.
  if settings.scoring_mode.includes("round_advancement"):
    advKey = roundAdvancementKey(G.round)
    originalGame = originalBracket.games.find(g => g.slotId === G.slotId)
    if originalGame && originalGame.predictedWinnerId === result.winningSchoolId:
      roundAdvancement += settings.round_points[advKey]

─── PER-SCHOOL SEEDING ACCURACY BONUS ─────────────────────────────────────
// Based entirely on originalBracket. Reseeded replacements are never awarded a bonus.

if settings.seeding_bonus_enabled:
  for each [schoolId, predictedExit] of Object.entries(originalBracket.predictedExitRound):
    actualExit = computeActualExit(schoolId, actualResultBySlotId, originalBracket.games)
    if actualExit !== null && actualExit === predictedExit:
      bonusKey = predictedExitToSeedingBonusKey(predictedExit)
      // Also guard: skip FIRST_FOUR seeding bonus if lock_mode = "before_round_of_64"
      if not isExcludedByLockMode(predictedExit as Round, settings.lock_mode):
        seedingBonus += settings.seeding_bonus_points[bonusKey]

return {
  roundAdvancement,
  correctWinner,
  seedingBonus,
  total: roundAdvancement + correctWinner + seedingBonus,
}
```

#### `computeActualExit` algorithm

```
computeActualExit(schoolId, actualResultBySlotId, games) → PredictedExitRound | null

// Walk all games that have actual results.
// Find the game in which this school appeared as a contestant AND lost.
// If the school won the Championship game, return "CHAMPIONSHIP_WINNER".
// Return null if the school hasn't been eliminated yet.

For each game G in games (in ROUND_ORDER):
  result = actualResultBySlotId.get(G.slotId)
  if result is null: continue

  if result.losingSchoolId === schoolId:
    if G.round === CHAMPIONSHIP: return "CHAMPIONSHIP_RUNNER_UP"
    else: return G.round

  if result.winningSchoolId === schoolId && G.round === CHAMPIONSHIP:
    return "CHAMPIONSHIP_WINNER"

return null  // still alive or not in this gender's bracket
```

---

### 6.5 `scoreEntry`

```typescript
function scoreEntry(input: ScoringInput): ScoreResult {
  const mensBreakdown   = scoreGender(input.mens,   input.settings);
  const womensBreakdown = scoreGender(input.womens, input.settings);

  const mensScore   = mensBreakdown.total;
  const womensScore = womensBreakdown.total;
  const totalScore  = mensScore + womensScore;
  const tiebreaker  = Math.abs(mensScore - womensScore);

  return {
    mensScore,
    womensScore,
    totalScore,
    tiebreaker,
    breakdown: { mens: mensBreakdown, womens: womensBreakdown },
  };
}
```

---

## 7. Test Plan

All tests use plain in-memory fixtures. No database, no filesystem, no network.

### 7.1 Shared test fixtures

Declare in a `src/lib/__tests__/fixtures.ts` file (or at the top of each test file):

```typescript
// Helper: build a RankMap from an ordered array of schoolIds (rank 1 = index 0)
buildRankMap(schoolIds: string[]): RankMap

// Minimal 4-team bracket slot structure (no First Four):
//
//   Championship (slotId: "CHAMP", round: FINAL_FOUR → wait, actually in 4-team:)
//   This 4-team fixture uses FINAL_FOUR and CHAMPIONSHIP rounds for simplicity.
//   The slot tree:
//
//     "LEAF_A" (leaf, schoolId: "A")  ─┐
//                                       ├─► "SF1" (FINAL_FOUR, slotIndex: 0)  ─┐
//     "LEAF_B" (leaf, schoolId: "B")  ─┘                                        ├─► "CHAMP" (CHAMPIONSHIP)
//     "LEAF_C" (leaf, schoolId: "C")  ─┐                                        │
//                                       ├─► "SF2" (FINAL_FOUR, slotIndex: 1)  ─┘
//     "LEAF_D" (leaf, schoolId: "D")  ─┘
//
buildMinimal4TeamSlots(): BracketSlotInput[]

// 8-team bracket (adds ELITE_8 round games, plus 2 First Four play-ins)
buildMinimal8TeamSlotsWithFirstFour(): BracketSlotInput[]

// Default competition settings (all modes enabled, non-zero points)
defaultSettings: CompetitionSettings = {
  lock_mode: "before_first_four",
  scoring_mode: ["round_advancement", "correct_winner"],
  seeding_bonus_enabled: true,
  reseed_mode: "fixed",
  max_lists_per_user: 1,
  round_points: { first_four: 1, round_of_64: 2, round_of_32: 4, sweet_16: 8, elite_8: 16, final_four: 32, championship: 64 },
  correct_winner_points: { first_four: 2, round_of_64: 4, round_of_32: 8, sweet_16: 16, elite_8: 32, final_four: 64, championship: 128 },
  seeding_bonus_points: { first_four: 1, round_of_64: 2, round_of_32: 4, sweet_16: 8, elite_8: 16, final_four: 32, championship_runner_up: 64, championship_winner: 128 },
}
```

---

### 7.2 `bracket.test.ts` — `resolveInitialBracket`

| Test name | What it verifies |
|---|---|
| `resolves championship winner as the highest-ranked school` | School ranked #1 wins every game and becomes champion |
| `resolves all games in correct round order` | `games` array is ordered FF → CHAMP; each game's round matches its slot |
| `predictedExitRound[loser] equals the round they lose in` | For each game loser, their exit round matches the slot's round |
| `championship runner-up gets CHAMPIONSHIP_RUNNER_UP exit` | The school that loses in the CHAMPIONSHIP slot gets that key |
| `championship winner gets CHAMPIONSHIP_WINNER exit` | Champion's `predictedExitRound` is `"CHAMPIONSHIP_WINNER"` |
| `uses lower rank number as winner` | Given two schools ranked #3 and #7, rank-3 school wins |
| `handles First Four: winner of play-in advances to R64` | FF winner's slot is subsequently populated and used in R64 matchup |
| `throws on unknown school in rankMap` | Slot references a schoolId not in rankMap → throws descriptive error |
| `throws on malformed slot with 1 feedingSlot` | Slot with exactly 1 feedingSlotId throws |
| `leafOccupants contains all initial seed positions` | All leaf slot IDs and their school IDs are present in `leafOccupants` |
| `feedingSlotIds preserved on every ResolvedGame` | Each game in output has correct `feedingSlotIds` matching the input slot |
| `higher-seed correctly beats lower-seed` | If #2 and #5 are paired, #2 wins regardless of order in slot |
| `deterministic output for same inputs` | Calling twice with identical inputs returns identical output |

---

### 7.3 `bracket.test.ts` — `applyActualResults`

| Test name | What it verifies |
|---|---|
| `returns structurally equal bracket when no actual results exist` | Empty `actualResults` → returned bracket games match original |
| `returns structurally equal bracket when all actual results match predictions` | If every actual winner == predicted winner, no game changes |
| `replaces eliminated predicted winner in future game` | School A predicted to reach the final, but lost in round 1; actual winner replaces A |
| `re-evaluates predicted winner by rank after replacement` | Replacement team B vs. original team C: lower rank of B/C is new predicted winner |
| `skips re-evaluation when both contestants are still alive` | Game where both A and B are alive in actual results → prediction unchanged |
| `cascading replacement across two rounds` | A eliminated in round 1 → replacement propagates correctly through rounds 2 and 3 |
| `championship runner-up and winner keys updated after replacement` | After a replacement that changes the finalist, `predictedExitRound` is correct |
| `already-played games take their actual result winner` | Slots with actual results always reflect the real winner |
| `does not mutate the input resolved bracket` | Input `resolved` object is reference-unchanged after the function returns |
| `updates championId when actual results change the predicted champion` | If predicted champion is eliminated, championId updates to new predicted winner |

---

### 7.4 `scoring.test.ts` — `scoreEntry`

#### Correct winner scoring

| Test name | What it verifies |
|---|---|
| `awards correct_winner_points for each correctly picked game` | Predict A beats B, A wins → earn `correct_winner_points[round]` |
| `awards zero correct_winner_points for wrong pick` | Predict A beats B, B wins → 0 points |
| `awards escalating points for correct picks in later rounds` | Championship correct pick earns more than R64 correct pick (per default settings) |
| `fixed: eliminated team's future games earn zero` | A eliminated in round 1; A's predicted future games earn 0 correct_winner_points |
| `reseed_by_ranking: correct pick of reseed winner earns points` | currentBracket predicts B (reseeded); actual winner is B → earns points |
| `reseed_by_ranking: no points when using originalBracket prediction for a reseeded slot` | originalBracket predicted A; reseeded game predicted B; actual is B → 0 points if using original |

#### Round advancement scoring

| Test name | What it verifies |
|---|---|
| `awards round_points cumulatively for each round won by original predicted winner` | A predicted to exit in E8 earns round_of_64 + round_of_32 + sweet_16 points (games they were predicted to WIN; E8 is the predicted loss round and earns no RA points) |
| `awards no round_points for rounds the original predicted winner does not reach` | A predicted to reach F4 but loses in S16 → earns round_of_64 + round_of_32 only; no S16, E8, or F4 round_points |
| `does NOT award round_points to reseeded replacement teams` | B replaces A in reseed mode and wins A's original path → 0 round_points for B |
| `first_four points awarded when lock_mode is before_first_four` | FF winner earns `round_points.first_four` when lock_mode = "before_first_four" |
| `winning a ROUND_OF_64 game earns round_of_64 key (1:1 mapping, same as correctWinnerKey)` | Confirms direct mapping: R64 game → "round_of_64" advancement key |
| `champion earns round_points for every game won, including championship` | Champion earns round_points for each round won from first game through CHAMPIONSHIP |

#### Seeding accuracy bonus

| Test name | What it verifies |
|---|---|
| `awards seeding_bonus when actual exit matches predicted exit exactly` | Predicted SWEET_16 exit, actually exits in SWEET_16 → earns `seeding_bonus_points.sweet_16` |
| `no bonus when team exits one round earlier than predicted` | Predicted S16, actually exits R32 → 0 bonus |
| `no bonus when team advances past predicted exit` | Predicted S16, actually reaches E8 → 0 bonus |
| `championship_winner bonus awarded only to actual champion` | Predicted champion actually wins → `championship_winner` bonus |
| `championship_runner_up bonus awarded only to actual runner-up` | Predicted runner-up actually loses in championship → `championship_runner_up` bonus |
| `championship_winner predicted but team loses in E8 → zero bonus` | Predicted champion eliminated early → 0 bonus |
| `seeding_bonus disabled: no bonus points awarded` | `seeding_bonus_enabled = false` → all seeding_bonus keys return 0 |
| `seeding bonus uses originalBracket, not currentBracket` | In reseed mode, a replacement team's seeding bonus is NOT awarded |

#### Lock mode guard

| Test name | What it verifies |
|---|---|
| `before_round_of_64: First Four games earn zero in all scoring modes` | FF games: correct_winner_points = 0, round_points = 0, no seeding bonus |
| `before_first_four: First Four games earn non-zero points` | FF games scored normally when lock_mode = "before_first_four" |

#### Combined scoring and tiebreaker

| Test name | What it verifies |
|---|---|
| `totalScore equals mensScore + womensScore` | Arithmetic check |
| `tiebreaker equals Math.abs(mensScore - womensScore)` | Mens 30, Women 10 → tiebreaker = 20 |
| `balanced scores produce lower tiebreaker than unbalanced` | Mens 20 / Women 20 tiebreaker = 0 beats Mens 35 / Women 5 tiebreaker = 30 |
| `empty actualResults produces zero scores` | No games played → all scores = 0, tiebreaker = 0 |
| `scoring_mode = [] produces zero scores` | No scoring modes enabled → 0 points everywhere |
| `breakdown.mens.total + breakdown.womens.total equals totalScore` | Breakdown consistency check |

---

## 8. Implementation Order

1. **Install Vitest** — `npm install --save-dev vitest @vitest/coverage-v8`; create `vitest.config.ts`; add scripts to `package.json`; verify `npm test` runs (zero tests is fine).
2. **Add types to `src/types/index.ts`** — add all types from §4. Run `npm run typecheck` to confirm zero errors.
3. **Create fixtures file** — `src/lib/__tests__/fixtures.ts` with `buildRankMap`, `buildMinimal4TeamSlots`, `buildMinimal8TeamSlotsWithFirstFour`, and `defaultSettings`.
4. **Implement `resolveInitialBracket`** in `src/lib/bracket.ts`.
5. **Write `resolveInitialBracket` tests** (§7.2). Run `npm test` — all should pass.
6. **Implement `applyActualResults`** in `src/lib/bracket.ts`.
7. **Write `applyActualResults` tests** (§7.3). Run `npm test` — all should pass.
8. **Implement `scoreEntry`** and all internal helpers in `src/lib/scoring.ts`.
9. **Write `scoring.test.ts`** (§7.4). Run `npm test` — all should pass.
10. **Final check** — `npm run typecheck && npm run lint && npm test` — all green before marking milestone complete.

---

## 9. Resolved Questions

1. ✅ **`round_points.round_of_64` treatment** — `roundAdvancementKey` now uses a direct 1:1 mapping identical to `correctWinnerKey`. Winning a Round of 64 game earns `round_points.round_of_64` points. The key is live and organizers should set it to a non-zero value. `CHAMPIONSHIP` maps to `"championship"` (not null).

2. ✅ **`applyActualResults` reseed scope** — Re-evaluate all unplayed future games in ROUND_ORDER. Partially-complete rounds (e.g., half of S16 played) are handled correctly: already-played slots are copied as-is; unplayed slots are re-evaluated if any contestant has been eliminated.

3. ✅ **Ties in `rankMap`** — Throw a descriptive error. The `@@unique([rankingListId, rank])` DB constraint prevents this in production; the guard exists for defensive correctness.

4. ✅ **`fixed` reseeding** — `applyActualResults` is never called for `fixed` competitions. The caller passes `originalBracket` as both `originalBracket` and `currentBracket` in `GenderScoringInput`.

5. ✅ **Seeding bonus and still-alive schools** — `computeActualExit` returns `null` for schools not yet eliminated. A `null` actual exit contributes 0 seeding bonus points. The bonus is only awarded after the school is eliminated or wins the championship.

6. ✅ **`lock_mode = "before_round_of_64"` and seeding bonus for FIRST_FOUR predicted exits** — The `isExcludedByLockMode` guard applies to the seeding bonus loop as well. A school predicted to exit in the First Four earns no seeding bonus when `lock_mode = "before_round_of_64"`.

