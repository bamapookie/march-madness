# Milestone 0.6.0 Plan — Bracket Viewer & Leaderboard

## Prerequisites confirmed

- `resolved_brackets` and `entry_scores` tables are already in the schema.
- `recomputeAllScores(seasonId)` stub already exists in `src/lib/scoring.ts` and is already called by
  `src/lib/import.ts` after every successful import.
- `resolveInitialBracket` and `applyActualResults` are fully implemented in `src/lib/bracket.ts`.
- `scoreEntry` is fully implemented in `src/lib/scoring.ts`.
- **A migration is required** for three new fields added in this milestone (see Schema Changes below).

---

## Schema Changes (migration required)

### `BracketSlot` — add `isInProgress`

```prisma
isInProgress Boolean @default(false)
```

Set to `true` during each import run when the ESPN event for this slot has `status.type.state === "in"`. Cleared back to
`false` when the final result is recorded for this slot. Allows the bracket viewer to show a distinct "Game in progress"
chip without an extra API call at view time.

### `EntryScore` — add `breakdownJson` and `maxPotentialRemaining`

```prisma
breakdownJson        Json? // ScoreBreakdownJson shape; null until first score computation
maxPotentialRemaining Int?  // null until first score computation; -1 signals "not computable"
```

Both fields are nullable and backwards-compatible — existing rows keep `null` until the next `recomputeAllScores` run.

---

## Step 1 — Implement `recomputeAllScores` in `src/lib/scoring.ts`

Replace the no-op stub with a real implementation. This is the heart of the milestone.

**Algorithm:**

1. Load all active competitions for the season (with their `settingsJson`).
2. For each competition, load all `CompetitionEntry` rows (with their `rankingList` → `rankingEntries` → `school`).
3. Skip any entry whose ranking list's effective lock time has not yet passed (not yet locked — entries may still
   change).
4. Load all `TournamentResult` rows for the season; convert to `ActualResultItem[]`.
5. Load all `BracketSlot` rows for the season (both genders).
6. For each entry: a. Build `rankMap: RankMap` from the entry's `rankingEntries`. b. If a `ResolvedBracket` row does not
   yet exist for this entry, call `resolveInitialBracket(...)` and upsert it. Once written, the original bracket never
   changes. c. If `reseed_mode = "reseed_by_ranking"`, call
   `applyActualResults(originalBracket, actualResults, "reseed_by_ranking", rankMap)` to get the current reseeded
   bracket. Otherwise use the original bracket. d. Call `scoreEntry(...)` with the (possibly reseeded) bracket, actual
   results, and competition settings. e. Serialize `scoreEntry`'s `breakdown` result into `breakdownJson` (see Step 2
   for shape). f. Compute `maxPotentialRemaining` (see Step 1a below). g. Upsert the `EntryScore` row with `mensScore`,
   `womensScore`, `totalScore`, `tiebreaker`, `breakdownJson`, and `maxPotentialRemaining`.
7. Log progress/errors; do not throw — failures for individual entries should not abort the whole run.

**File:** `src/lib/scoring.ts` (replace stub in place; no new file needed).

**Lock time helper:** The ranking list's effective lock time is
`settings.lock_mode === "BEFORE_FIRST_FOUR" ? season.firstFourLockAt : season.roundOf64LockAt`.

**`resolveInitialBracket` input shape** (from `src/types/index.ts`):

```ts
BracketResolutionInput = {
  gender: Gender;
  slots: BracketSlotInput[]; // field is `slots`, not `bracketSlots`
  rankMap: RankMap;
}
```

Call it once for `MENS` and once for `WOMENS`; store both JSON blobs in `mensJson` / `womensJson`.

### Step 1a — Computing `maxPotentialRemaining`

The goal is: given the current state of the real tournament, what is the maximum number of additional points this entry
could still earn if all of their remaining predictions come true?

**For `reseed_mode = "fixed"`:**

Build a set of eliminated schools from `actualResults` (all `losingSchoolId` values). Then for each unplayed game slot
(no `TournamentResult` for that `bracketSlotId`), look up the predicted winner from the original bracket and check if
that school is eliminated. If not eliminated, the user could still earn:

- **Correct winner**: `correct_winner_points[round]` if `"correct_winner"` is in `scoring_mode`.
- **Round advancement**: `round_points[round]` if `"round_advancement"` is in `scoring_mode` AND this round is strictly
  before the team's predicted exit round (i.e. a round where they were predicted to win).
- **Seeding accuracy bonus**: if `seeding_bonus_enabled` AND this is the team's predicted exit game (the round they were
  predicted to _lose_ in), add `seeding_bonus_points[predictedExitRound]`. This bonus is only counted once per team —
  for the specific game slot where they were predicted to exit.

Sum across all unplayed game slots for both genders. Exclude `first_four` if `lock_mode = "before_round_of_64"`.

**For `reseed_mode = "reseed_by_ranking"`:**

Set `maxPotentialRemaining = -1` (sentinel meaning "not computable"). Display as "N/A" in the UI. This is an open
question — see Decision Point 5.

---

## Step 2 — New types in `src/types/index.ts`

Add the following types:

```ts
// Leaderboard row returned by GET /api/competitions/[id]/leaderboard
// The shape stored in EntryScore.breakdownJson.
// Captures earned points by scoring method and gender so the UI can show a full
// breakdown of where every point came from.
export type ScoreBreakdownJson = {
  mens: {
    roundAdvancement: number; // points from round_advancement scoring mode
    correctWinner: number; // points from correct_winner scoring mode
    seedingBonus: number; // points from seeding accuracy bonus
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

// Leaderboard row returned by GET /api/competitions/[id]/leaderboard
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
  tiebreaker: number; // abs(mens - womens); lower is better
  maxPotentialRemaining: number | null; // null = not yet computed; -1 = N/A (reseed mode)
  computedAt: string | null; // ISO timestamp; null = not yet computed
};

// Response shape for GET /api/competitions/[id]/leaderboard
export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
  isLocked: boolean; // true if competition is past its effective lock time
  lastComputedAt: string | null; // most recent computedAt across all entry scores
};

// Score breakdown detail for one entry
export type EntryScoreDetail = {
  entryId: string;
  rankingListId: string;
  rankingListName: string;
  mensScore: number;
  womensScore: number;
  totalScore: number;
  tiebreaker: number;
  maxPotentialRemaining: number | null; // null = not yet computed; -1 = N/A (reseed mode)
  breakdown: ScoreBreakdownJson | null; // null until first computation
  computedAt: string | null;
};

// Response shape for GET /api/competitions/[id]/entries/[entryId] (GET added in Step 3)
export type EntryDetailResponse = {
  entry: CompetitionEntrySummary;
  score: EntryScoreDetail | null;
  resolvedBracket: ResolvedBracketData | null; // null if not yet computed
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[]; // bracket slot IDs for games currently in progress
};
```

---

## Step 3 — New and updated API routes

### 3a. `GET /api/competitions/[id]/leaderboard/route.ts` _(new file)_

- Auth required; same `canViewCompetition` access check as the lobby (`src/lib/competition.ts`).
- Query `EntryScore` for all entries in this competition, join with `CompetitionEntry` → `User` + `RankingList`.
- Sort: `totalScore DESC`, then `tiebreaker ASC` (lower tiebreaker wins), then `submittedAt ASC` (stable order).
- Assign `rank` (handle ties: entries with equal score and tiebreaker share the same rank number).
- Return `{ data: LeaderboardResponse, error: null }`.
- If no scores exist yet (tournament not started / entries not locked), return an empty `entries: []` array with
  `isLocked: false`.

### 3b. `GET /api/competitions/[id]/entries/[entryId]/route.ts` _(add GET to existing file)_

The file currently only has `DELETE`. Add `GET`:

- Auth required; must be the entry owner, the competition organizer, or any competition member who has ≥1 submitted
  entry (post-cutoff access rules).
- Load `CompetitionEntry` with `resolvedBracket`, `score`, and `rankingList` → `rankingEntries` → `school`.
- Load `TournamentResult` rows for the season as `ActualResultItem[]`.
- Query `BracketSlot` where `isInProgress = true` for the season; extract their IDs as `inProgressSlotIds`.
- Return `{ data: EntryDetailResponse, error: null }`.
- If `resolvedBracket` is null (not yet computed), return it as null — the UI will show a placeholder.

### 3c. `GET /api/ranking-lists/[id]/bracket/route.ts` _(new file)_

Standalone bracket viewer for a user's own ranking list (outside any competition context).

- Auth required; must own the ranking list.
- Resolve the bracket live from `rankingEntries` + `bracketSlots` (call `resolveInitialBracket`).
- Load actual results for the season.
- Query `BracketSlot` where `isInProgress = true` for the season; extract their IDs as `inProgressSlotIds`.
- Return
  `{ data: { resolvedBracket: ResolvedBracketData, actualResults: ActualResultItem[], inProgressSlotIds: string[] }, error: null }`.

---

## Step 4 — `BracketViewer` component (`src/components/bracket/bracket-viewer.tsx`)

A `"use client"` React component.

**Props:**

```ts
{
  resolvedBracket: ResolvedBracketData;   // mens + womens resolved games
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[];            // slot IDs for games currently being played
  schoolNames: Record<string, string>;    // schoolId → display name
  showScore?: boolean;                    // show correct/wrong overlays
}
```

**Layout:**

- Toggle tabs at top: **Men's** / **Women's**.
- Within each tab:
  - 4 region cards arranged in a 2×2 grid (e.g. East, West top row; South, Midwest bottom row).
  - Each region card shows rounds as columns: R64 → R32 → S16 → E8 (left to right).
  - Each game slot shows: School A name vs. School B name, with predicted winner highlighted.
  - Overlay chip per slot when `showScore` is true — four mutually exclusive states determined in this priority order:
    1. 🔄 **In progress** — slot ID is in `inProgressSlotIds` (game is currently being played; no winner yet).
    2. ✅ **Correct** — game is complete and predicted winner matches `actualResults`.
    3. ❌ **Wrong** — game is complete and predicted winner does not match `actualResults`.
    4. ⬜ **Not yet played** — no result and not in progress.
  - The "in progress" state takes priority over everything since a result may have just arrived or may be stale.
  - Below the 4 regions: a **Final Four / Championship** section showing the 2 semis + championship game.

**No SVG bracket lines required for this milestone.** The focus is getting all information into the bracket view
clearly. Visual polish (connecting lines, bracket art) is deferred to 0.7.0.

**Import responsibility:** During each import run, `src/lib/import.ts` must set `isInProgress = true` on any
`BracketSlot` whose ESPN event has `status.type.state === "in"`, and set `isInProgress = false` on slots that are now
complete (result recorded) or not yet started. This flag is the sole source of truth for the "in progress" chip.

**Fallback:** If `resolvedBracket` is null, show a "Bracket not yet available" message.

---

## Step 5 — Leaderboard page (`src/app/competition/[id]/leaderboard/page.tsx`)

Server component.

- Apply the same `canViewCompetition` gate used in the lobby page.
- Fetch leaderboard data server-side via direct DB query (same logic as the API route — or call the shared lib function
  if extracted).
- Render a ranked table:

  | #   | User          | Entry                            | Men's | Women's | Total | Max Remaining | Tiebreaker |
  | --- | ------------- | -------------------------------- | ----- | ------- | ----- | ------------- | ---------- |
  | 1   | Avatar + Name | Entry name (link → entry detail) | 120   | 115     | 235   | 40            | 5          |

- **Max Remaining** column: show the `maxPotentialRemaining` value. If `-1`, show "N/A". If `null`, omit or show "—".
- Tiebreaker column: show the value with a tooltip "Lower = better balanced across Men's & Women's".
- Guard: if no `TournamentResult` rows exist for the season, redirect to the competition lobby — the lobby will show the
  "first game" message in place of the leaderboard link.
- "Back to Competition" link at top.
- Accessible from the competition lobby via a "Leaderboard →" button that is only rendered once a result exists; until
  then a static message reads _"The leaderboard will be available once the first game begins."_

---

## Step 6 — Entry detail page (`src/app/competition/[id]/entries/[entryId]/page.tsx`)

Server component.

- Auth + access check (entry owner, organizer, or member w/ entry).
- Render two panels side by side (or stacked on mobile):
  - **Score panel**: total score, Men's score, Women's score, tiebreaker value, max potential remaining, `computedAt`
    timestamp. If score is null, show "Scores not yet computed."
    - Include a **score breakdown table** driven by `breakdownJson`:

      | Scoring Method    | Men's | Women's | Total |
      | ----------------- | ----- | ------- | ----- |
      | Correct Winner    | 80    | 75      | 155   |
      | Round Advancement | 30    | 30      | 60    |
      | Seeding Bonus     | 10    | 10      | 20    |
      | **Total**         | 120   | 115     | 235   |

    - Only show rows for scoring methods that are active in the competition settings.

  - **Bracket panel**: `<BracketViewer>` component with `showScore={true}` and actual results overlaid. If
    `resolvedBracket` is null, show "Bracket not yet available — check back after the competition locks."

- "Back to Leaderboard" link.

---

## Step 7 — Standalone bracket viewer (`src/app/bracket/[id]/page.tsx`)

Server component. `[id]` = ranking list ID.

- Auth required; must own the ranking list.
- Resolve bracket live (or read from any `ResolvedBracket` associated with the list's competition entries).
- Render `<BracketViewer>` without score overlay (this is just a preview of their picks).
- Link back to the ranking editor (`/ranking/[id]`).

Note: the existing `src/app/bracket/page.tsx` is a placeholder — replace or redirect it to the user's dashboard if they
have ranking lists, or show a "You don't have any ranking lists yet" state.

---

## Step 8 — Navigation & lobby wiring

### Nav (`src/components/nav.tsx`)

No new top-level nav link needed — bracket and leaderboard are always reached from within a competition or ranking list.

### Competition lobby (`src/app/competition/[id]/page.tsx`)

- If at least one `TournamentResult` exists for the season: show a **"Leaderboard →"** button/link.
- Otherwise: show the static message _"The leaderboard will be available once the first game begins."_ in the same
  location. The message is the same whether the competition is pre-lock or locked — users don't need the distinction.
- Update the entries table (in `lobby-client.tsx`) so each entry row is a clickable link to
  `/competition/[id]/entries/[entryId]` when the competition is locked and a score exists.

### Ranking list card (`src/components/ranking/ranking-list-card.tsx`)

- Add a "View Bracket →" link to `/bracket/[id]`.

---

## Decision points to resolve before implementation

1. **Reseeded bracket caching**: `recomputeAllScores` recomputes the reseeded bracket on every run. For competitions
   with many entries and `reseed_by_ranking`, this is fine since scoring runs only on import (not on every read). No
   schema change needed — the current approach is sufficient.

2. **Leaderboard visibility before the first game** ✅ _resolved_: The leaderboard link and page are hidden until at
   least one `TournamentResult` row exists for the season (i.e. the first game of the tournament is in progress or
   complete). The threshold is the first game for the season overall — not per-competition — because the tournament
   schedule is the same for everyone. Wherever a "Leaderboard →" button or link would appear (competition lobby, entry
   detail page), show a static message in its place instead:
   - If the competition has **not yet locked**: _"The leaderboard will be available once the first game begins."_
   - If the competition **is locked but no results exist yet**: _"The leaderboard will be available once the first game
     begins."_
   - The message is the same in both cases — users don't need to know the internal reason, only when to come back. The
     leaderboard page itself (`/competition/[id]/leaderboard`) should also guard against direct URL access and redirect
     to the competition lobby with the same message if no results exist yet.

3. **Bracket viewer visual fidelity** ✅ _resolved_: Deferred to 0.7.0. For this milestone, the priority is getting all
   necessary information — matchup names, predicted winner, chip status — clearly visible in a functional layout.
   Connecting lines and NCAA-style bracket art are a 0.7.0 polish task.

4. **Score breakdown storage** ✅ _resolved_: Add `breakdownJson Json?` to `EntryScore` (nullable,
   backwards-compatible). The shape (`ScoreBreakdownJson`) captures points by gender and by scoring method
   (roundAdvancement, correctWinner, seedingBonus). Populated during `recomputeAllScores`; avoids re-running
   `scoreEntry` on every page view. A migration is required (see Schema Changes above).

5. **Max potential remaining under `reseed_by_ranking`** ⚠️ _open question_: For fixed brackets, max potential is
   computed straightforwardly (see Step 1a). For reseeded brackets the situation is more complex:
   - After reseeding, the bracket's future predicted matchups have already changed based on real results. We could
     compute max potential from the _current_ reseeded state by assuming every current predicted winner wins all
     remaining games. However, this is an approximation — as more real results come in, the reseeded bracket will
     continue to change, so the "max potential" itself is a moving target.
   - It is also unclear whether max potential in a reseeded bracket should account for correct-winner points (since
     those are earned on slot-by-slot predictions that change with each reseed), round-advancement points (which are
     always tied to original predictions), or both.
   - **For this milestone**: store `-1` (sentinel "N/A") for reseeded competitions. Display "N/A" in all max remaining
     cells. Revisit in a follow-up session before the tournament starts.

---

## Implementation order

```
0. Migration          — add isInProgress to BracketSlot; breakdownJson + maxPotentialRemaining to EntryScore
1. src/lib/scoring.ts — implement recomputeAllScores (+ Step 1a max potential)
2. src/lib/import.ts  — update isInProgress flag on BracketSlot during each import run
3. src/types/index.ts — add ScoreBreakdownJson, updated LeaderboardEntry, EntryScoreDetail, EntryDetailResponse
4. API routes         — leaderboard GET, entry GET, standalone bracket GET
5. src/components/bracket/ — BracketViewer component
6. Leaderboard page   — src/app/competition/[id]/leaderboard/page.tsx
7. Entry detail page  — src/app/competition/[id]/entries/[entryId]/page.tsx
8. Standalone bracket viewer — src/app/bracket/[id]/page.tsx
9. Nav & lobby wiring — lobby + ranking list card links
```

The migration (step 0) and import update (step 2) are prerequisites for steps 1 and 5 respectively. Steps 3–4 are pure
logic/API with no UI dependency; steps 5–8 depend on step 4 and on each other only loosely. Step 9 is the final wiring
pass.
