# Milestone 0.6.0 Plan — Bracket Viewer & Leaderboard

## Prerequisites confirmed

- `resolved_brackets` and `entry_scores` tables are **already in the schema** — no migration needed.
- `recomputeAllScores(seasonId)` stub already exists in `src/lib/scoring.ts` and is already called by
  `src/lib/import.ts` after every successful import.
- `resolveInitialBracket` and `applyActualResults` are fully implemented in `src/lib/bracket.ts`.
- `scoreEntry` is fully implemented in `src/lib/scoring.ts`.

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
   `applyActualResults(originalBracket, actualResults,    "reseed_by_ranking", rankMap)` to get the current reseeded
   bracket. Otherwise use the original bracket. d. Call `scoreEntry(...)` with the (possibly reseeded) bracket, actual
   results, and competition settings. e. Upsert the `EntryScore` row for this entry.
7. Log progress/errors; do not throw — failures for individual entries should not abort the whole run.

**File:** `src/lib/scoring.ts` (replace stub in place; no new file needed).

**Lock time helper:** The ranking list's effective lock time is
`settings.lock_mode === "BEFORE_FIRST_FOUR" ? season.firstFourLockAt : season.roundOf64LockAt`.

**`resolveInitialBracket` input shape** (from `src/types/index.ts`):

```ts
BracketResolutionInput = {
  rankMap: RankMap;
  bracketSlots: BracketSlotInput[];
  gender: Gender;
}
```

Call it once for `MENS` and once for `WOMENS`; store both JSON blobs in `mensJson` / `womensJson`.

---

## Step 2 — New types in `src/types/index.ts`

Add the following types:

```ts
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
  computedAt: string | null;
};

// Response shape for GET /api/competitions/[id]/entries/[entryId] (GET added in Step 3)
export type EntryDetailResponse = {
  entry: CompetitionEntrySummary;
  score: EntryScoreDetail | null;
  resolvedBracket: ResolvedBracketData | null; // null if not yet computed
  actualResults: ActualResultItem[];
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
- Return `{ data: EntryDetailResponse, error: null }`.
- If `resolvedBracket` is null (not yet computed), return it as null — the UI will show a placeholder.

### 3c. `GET /api/ranking-lists/[id]/bracket/route.ts` _(new file)_

Standalone bracket viewer for a user's own ranking list (outside any competition context).

- Auth required; must own the ranking list.
- Resolve the bracket live from `rankingEntries` + `bracketSlots` (call `resolveInitialBracket`).
- Load actual results for the season.
- Return `{ data: { resolvedBracket: ResolvedBracketData, actualResults: ActualResultItem[] }, error: null }`.

---

## Step 4 — `BracketViewer` component (`src/components/bracket/bracket-viewer.tsx`)

A `"use client"` React component.

**Props:**

```ts
{
  resolvedBracket: ResolvedBracketData;   // mens + womens resolved games
  actualResults: ActualResultItem[];
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
  - Overlay chip per slot: 🟢 correct / 🔴 wrong / ⬜ not yet played — determined by comparing predicted winner to
    `actualResults`.
  - Below the 4 regions: a **Final Four / Championship** section showing the 2 semis + championship game.

**No SVG bracket lines required for this milestone.** Visual polish (connecting lines, bracket art) is deferred to
0.7.0.

**Fallback:** If `resolvedBracket` is null, show a "Bracket not yet available" message.

---

## Step 5 — Leaderboard page (`src/app/competition/[id]/leaderboard/page.tsx`)

Server component.

- Apply the same `canViewCompetition` gate used in the lobby page.
- Fetch leaderboard data server-side via direct DB query (same logic as the API route — or call the shared lib function
  if extracted).
- Render a ranked table:

  | #   | User          | Entry                            | Men's | Women's | Total | Tiebreaker |
  | --- | ------------- | -------------------------------- | ----- | ------- | ----- | ---------- |
  | 1   | Avatar + Name | Entry name (link → entry detail) | 120   | 115     | 235   | 5          |

- Tiebreaker column: show the value with a tooltip "Lower = better balanced across Men's & Women's".
- When `isLocked = false`: show a banner "Tournament not yet locked — scores will appear once entries are locked."
- "Back to Competition" link at top.
- Accessible from the competition lobby via a "Leaderboard →" button.

---

## Step 6 — Entry detail page (`src/app/competition/[id]/entries/[entryId]/page.tsx`)

Server component.

- Auth + access check (entry owner, organizer, or member w/ entry).
- Render two panels side by side (or stacked on mobile):
  - **Score panel**: total score, Men's score, Women's score, tiebreaker value, `computedAt` timestamp. If score is
    null, show "Scores not yet computed."
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

- Add a **"Leaderboard →"** button/link visible once the competition is locked (or at all times with a grayed state
  before lock showing "Available after lock").
- Update the entries table (in `lobby-client.tsx`) so each entry row is a clickable link to
  `/competition/[id]/entries/[entryId]` when the competition is locked and a score exists.

### Ranking list card (`src/components/ranking/ranking-list-card.tsx`)

- Add a "View Bracket →" link to `/bracket/[id]`.

---

## Decision points to resolve before implementation

1. **Reseeded bracket caching**: `recomputeAllScores` recomputes the reseeded bracket on every run. For competitions
   with many entries and `reseed_by_ranking`, this is fine since scoring runs only on import (not on every read). No
   schema change needed — the current approach is sufficient.

2. **Leaderboard visibility before lock**: The plan shows the leaderboard link at all times (with an empty/placeholder
   state before lock). An alternative is to hide the link entirely until the competition is locked. Preference?

3. **Bracket viewer visual fidelity**: The plan calls for a "region cards with round columns" layout without SVG
   connecting lines. This is the simplest implementation that clearly shows all matchups. Full NCAA bracket art with
   connecting lines can be added in 0.7.0 polish pass.

4. **Score detail breakdown (round-by-round)**: `scoreEntry` returns a `ScoreBreakdown` with per-round breakdowns. The
   entry detail page can show this as a table. Confirm whether the full breakdown should be stored in `EntryScore`
   (requires a schema addition for a JSON `breakdownJson` column) or computed on the fly from the stored
   `resolvedBracket` + actual results on every page load.
   - **Recommendation**: add a `breakdownJson Json?` column to `EntryScore` (nullable, backwards-compatible). Populate
     it during `recomputeAllScores`. This avoids re-running `scoreEntry` on every page view.

---

## Implementation order

```
1. src/lib/scoring.ts          — implement recomputeAllScores
2. src/types/index.ts          — add LeaderboardEntry, LeaderboardResponse, EntryScoreDetail, EntryDetailResponse
3. API routes                  — leaderboard GET, entry GET, standalone bracket GET
4. src/components/bracket/     — BracketViewer component
5. Leaderboard page            — src/app/competition/[id]/leaderboard/page.tsx
6. Entry detail page           — src/app/competition/[id]/entries/[entryId]/page.tsx
7. Standalone bracket viewer   — src/app/bracket/[id]/page.tsx
8. Nav & lobby wiring          — lobby + ranking list card links
```

Steps 1–3 are pure logic/API with no UI dependency; steps 4–7 depend on step 3 and on each other only loosely. Step 8 is
the final wiring pass.
