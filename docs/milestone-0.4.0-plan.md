# Milestone 0.4.0 — ESPN Import & Season Setup: Implementation Plan

## Overview

Build the data pipeline that pulls schools, bracket slots, and game results from ESPN into the DB, exposes it to admins, and runs automatically via Vercel Cron.

---

## Step 1 — Schema Migration

Add to `prisma/schema.prisma`:

- **`TournamentSeason`**: add `mensEspnTournamentId String?` and `womensEspnTournamentId String?`
- **New `ImportLog` model**:
  ```
  id                   String    @id @default(cuid())
  seasonId             String
  season               TournamentSeason @relation(...)
  gender               Gender?
  status               ImportStatus  (SUCCESS | FAILURE enum)
  schoolsUpserted      Int       @default(0)
  bracketSlotsUpserted Int       @default(0)
  resultsUpserted      Int       @default(0)
  errorMessage         String?
  startedAt            DateTime  @default(now())
  completedAt          DateTime?
  ```

`ImportLog.startedAt`/`completedAt` drive the stale-data warning on the admin page.

Run `npx prisma migrate dev` after schema changes.

---

## Step 2 — ESPN Response Types

Create `src/types/espn.ts` with strict interfaces (no `any`) for all ESPN payloads:

- **Teams**: `EspnTeamsResponse → sports[].leagues[].teams[].team { id, displayName, shortDisplayName, abbreviation }`
- **Scoreboard**: `EspnScoreboardResponse → events[] { id, date, status.type.completed, competitions[].competitors[] { team.id, winner } }`
- **Tournament bracket**: `EspnTournamentResponse` — field paths to verify by calling the endpoint manually: `groups[].seeds[].{ order, displayName, teams[].id }` and `groups[].bracket.rounds[].games[].{ id, competitors[], winner }`

> ⚠️ The bracket endpoint shape is the hardest to reverse-engineer. Sample a real call first and document the exact field path in a comment block before writing the types.

---

## Step 3 — `src/lib/admin.ts`

```typescript
export const ADMIN_EMAILS: readonly string[] = ["your@email.com"];
export function isAdmin(email: string | null | undefined): boolean;
```

Both the API route and admin page import from here. One place to update when adding admins.

---

## Step 4 — `src/lib/import.ts`

Five exported async functions:

| Function | Description |
|---|---|
| `fetchEspnJson<T>(url: string): Promise<T>` | Thin internal `fetch` wrapper — one place to mock in tests |
| `importSchools(seasonId, gender): Promise<{created, updated}>` | ESPN teams endpoint → upsert `School` rows by `(seasonId, name)` |
| `importBracketSlots(seasonId, gender, espnTournamentId): Promise<{created, updated}>` | ESPN bracket endpoint → upsert `BracketSlot` rows; build `nextSlotId` advancement chain via two-pass approach |
| `importResults(seasonId, gender): Promise<{created, updated}>` | ESPN scoreboard (filtered by tournament group ID) → upsert `TournamentResult` rows idempotently via `espnGameId` unique constraint |
| `runFullImport(seasonId): Promise<ImportResult>` | Orchestrates all functions for both genders; writes `ImportLog` on success or failure; includes `// TODO(0.6.0): trigger score recomputation` stub |

**Bracket slot advancement chain** (trickiest part): Build the 4-region × 16-seed tree *programmatically* from fixed NCAA bracket rules (seed pairs: 1v16, 2v15, … 8v9). Use ESPN data only to fill which school occupies each seeded leaf slot and which games are completed. This avoids depending on ESPN's internal slot index format.

---

## Step 5 — API Routes

### `src/app/api/admin/import/route.ts` (POST)
1. Call `auth()` → check `isAdmin(session?.user?.email)` → 403 if not admin
2. Load active `TournamentSeason`
3. Call `runFullImport(season.id)`
4. Return `{ data: ImportResult, error: null }` or `{ data: null, error: string }`

### `src/app/api/cron/import-results/route.ts` (GET)
1. Validate `Authorization: Bearer ${process.env.CRON_SECRET}` → 401 if missing/wrong
2. Short-circuit with `{ skipped: true }` if no active season or if `now` is outside the active tournament window
3. Call `runFullImport(season.id)`
4. Return 200 with result JSON or 500 with error

---

## Step 6 — `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/import-results",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

The cron route short-circuits when outside the active tournament window to avoid unnecessary ESPN calls between seasons.

---

## Step 7 — `src/scripts/import-results.ts`

Mirror the pattern of `src/scripts/seed-test-season.ts`:
1. Create explicit `Pool` + `PrismaPg` + `PrismaClient` (not the singleton)
2. Load active season
3. Call `runFullImport`
4. Log outcome and close the pool

---

## Step 8 — `src/app/admin/page.tsx`

Replace the placeholder. Server component loads:
- Last `ImportLog` row (timestamp, status, counts, error message)
- Active season record (school/bracket-slot/result counts via Prisma aggregates)
- ESPN tournament IDs from the season record

Pass to a `"use client"` child `AdminImportPanel` that renders:
- Season name + ESPN tournament IDs
- School / slot / result counts
- Last import timestamp
- `⚠ Stale data` badge when last successful `ImportLog` > 30 minutes old during active season
- "Run Import Now" button → `POST /api/admin/import` → refresh
- Error message from last failed log

---

## Step 9 — Unit Tests

Add `src/lib/__tests__/import.test.ts`:
- Use `vi.stubGlobal('fetch', mockFetch)` with fixture JSON from real ESPN responses (saved as `src/lib/__tests__/fixtures/espn-*.json`)
- Mock `@/lib/db` with `vi.mock`
- Test cases:
  - School upsert idempotency (calling twice does not duplicate rows)
  - Result import skips already-imported games by `espnGameId`
  - `runFullImport` writes a `SUCCESS` `ImportLog` row on success
  - Network error writes a `FAILURE` `ImportLog` row

---

## Step 10 — Docs

- Mark 0.4.0 `✅ _complete_` in `CLAUDE.md`
- Add CHANGELOG entry
- Bump `package.json` to `0.4.0`
- Update README milestone table

---

## Implementation Order

```
1. Schema migration (ImportLog, ESPN IDs on season)
2. ESPN types (src/types/espn.ts)
3. src/lib/admin.ts (isAdmin helper)
4. src/lib/import.ts (fetchEspnJson → importSchools → importBracketSlots → importResults → runFullImport)
5. API routes (admin/import, cron/import-results)
6. vercel.json
7. Dev script (src/scripts/import-results.ts)
8. Admin page (src/app/admin/page.tsx)
9. Unit tests
10. Docs
```

---

## Key Open Questions to Resolve Before Coding

### 1. ESPN Tournament ID for 2026
The 2026 tournament ID won't be known until Selection Sunday (March 15). Two options:
- **Option A (recommended for safety):** Add an admin UI input on the season record to set `mensEspnTournamentId` / `womensEspnTournamentId` once announced
- **Option B (fully automated):** Write a `discoverTournamentId(gender, year)` helper that fetches the scoreboard and extracts the tournament ID from the first NCAA Tournament event

Option B is cleaner long-term; Option A is safer to ship first. Consider shipping both: auto-discover as the default, but allow manual override via the admin UI.

### 2. Score Recomputation Stub (for 0.6.0 wiring)
Add an exported no-op to `src/lib/scoring.ts` now so `import.ts` can call it without a compile error:
```typescript
export async function recomputeAllScores(_seasonId: string): Promise<void> {}
```
Milestone 0.6.0 fills in the body.

### 3. Admin Email Configuration
Hard-code the admin email(s) in `src/lib/admin.ts`. Document in `.env.example` that this list must be updated before deploy. Could also be driven by an `ADMIN_EMAILS` env var (comma-separated) for easier Vercel configuration without code changes.

