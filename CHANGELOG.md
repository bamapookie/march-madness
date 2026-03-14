# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.4.0] — 2026-03-13

### ESPN Import & Season Setup

- `src/lib/import.ts` — ESPN API import library (no scheduler; called by cron route and dev script):
  - `fetchEspnJson<T>` — thin fetch wrapper; mocked in tests via `vi.spyOn`
  - `discoverTournamentId(gender)` — auto-discovers ESPN tournament ID by scanning the NCAA Tournament
    scoreboard for March dates; stores result on the `TournamentSeason` row
  - `importSchools(seasonId, gender, espnTournamentId)` — upserts `School` rows from the tournament
    bracket and enriches with `shortDisplayName`/`abbreviation` from the teams endpoint
  - `importBracketSlots(seasonId, gender, espnTournamentId)` — builds the full 4-region × 16-seed
    slot tree programmatically using fixed NCAA bracket rules; two-pass upsert sets `nextSlotId`;
    stores `espnEventId` on game slots for result matching
  - `importResults(seasonId, gender)` — fetches completed games from ESPN scoreboard, matches to
    bracket slots via `espnEventId`, upserts `TournamentResult` rows idempotently
  - `runFullImport(seasonId)` — orchestrates both genders; writes `ImportLog` on success or failure;
    calls `recomputeAllScores` stub (wired fully in 0.6.0)
- `src/lib/admin.ts` — `isAdmin(email)` helper; reads admin emails from `ADMIN_EMAILS` env var
  (comma-separated); no hard-coded addresses in source
- `src/lib/scoring.ts` — added `recomputeAllScores(_seasonId)` no-op stub for 0.6.0 wiring
- `src/types/espn.ts` — strict TypeScript interfaces for all ESPN API responses (no `any`):
  `EspnTeamsResponse`, `EspnScoreboardResponse`, `EspnTournamentResponse` and all sub-types
- `src/app/api/admin/import/route.ts` — `POST` route; admin-only; triggers `runFullImport`
- `src/app/api/admin/season/route.ts` — `PATCH` route; admin-only; updates `mensEspnTournamentId`
  and `womensEspnTournamentId` on the active season
- `src/app/api/cron/import-results/route.ts` — `GET` route; validated by `CRON_SECRET`; short-circuits
  outside the tournament window; calls `runFullImport`
- `vercel.json` — cron schedule `*/5 * * * *` pointing at `/api/cron/import-results`
- `src/scripts/import-results.ts` — dev script (`npm run import:results`); creates own Prisma client,
  finds active season, calls `runFullImport`, logs results
- `src/app/admin/page.tsx` — server component; redirects non-admins; loads season stats and last
  import log; passes serialized data to `AdminImportPanel`
- `src/components/admin/admin-import-panel.tsx` — client component with:
  - Season stats (school/slot/result counts, lock timestamps)
  - ESPN tournament ID editor with save via `PATCH /api/admin/season`
  - Last import status (timestamp, counts, error message)
  - `⚠ Stale data` badge when last success import is > 30 min old during active tournament
  - "Run Import Now" button via `POST /api/admin/import`
- Schema additions (migration `20260313151919_add_espn_import_support`):
  - `TournamentSeason.mensEspnTournamentId String?`
  - `TournamentSeason.womensEspnTournamentId String?`
  - `BracketSlot.espnEventId String? @unique`
  - `ImportStatus` enum (`SUCCESS` | `FAILURE`)
  - `ImportLog` model
- `.env.example` — added `ADMIN_EMAILS` variable documentation
- All TypeScript strict; zero type errors; all 50 pre-existing tests pass

## [0.3.0] — 2026-03-13

### Core Domain Logic

- `src/lib/bracket.ts` — pure bracket resolution functions (no DB, no async I/O):
  - `resolveInitialBracket` — walks the bracket slot tree bottom-up using a user's rank map; produces a fully populated
    `ResolvedBracketData` with all games, predicted exit rounds, and champion
  - `applyActualResults` — applies real tournament results in `reseed_by_ranking` mode; replaces eliminated teams with
    actual advancing teams and re-evaluates matchup winners by rank; does not mutate input
- `src/lib/scoring.ts` — pure scoring engine:
  - `scoreEntry` — computes combined Men's + Women's score for any competition settings configuration
  - Supports `correct_winner`, `round_advancement`, and `seeding_accuracy_bonus` scoring modes
  - Respects `lock_mode` (`before_first_four` / `before_round_of_64`) — First Four games excluded when appropriate
  - Tiebreaker: `Math.abs(mensScore - womensScore)` — lower is better
- `src/types/index.ts` — added all bracket and scoring types: `Round`, `Gender`, `PredictedExitRound`, `RankMap`,
  `BracketSlotInput`, `ResolvedGame`, `ResolvedBracketData`, `BracketResolutionInput`, `ActualResultItem`,
  `GenderScoringInput`, `ScoringInput`, `ScoreBreakdown`, `ScoreResult`
- `vitest.config.ts` — Vitest configured with node environment, `@` path alias, and v8 coverage for lib files
- `src/lib/__tests__/fixtures.ts` — shared test fixtures: `buildRankMap`, `buildMinimal4TeamSlots`,
  `buildMinimal8TeamSlotsWithFirstFour`, `defaultSettings`
- `src/lib/__tests__/bracket.test.ts` — 23 unit tests covering `resolveInitialBracket` and `applyActualResults`
- `src/lib/__tests__/scoring.test.ts` — 27 unit tests covering all scoring modes, lock mode guards, combined scoring,
  and tiebreaker
- All 50 tests pass; zero TypeScript errors; zero lint errors

---

## [0.2.0] — 2026-03-12

### Ranking Lists

- `LockMode` enum (`BEFORE_FIRST_FOUR` / `BEFORE_ROUND_OF_64`) added to Prisma schema; migration applied
- `src/lib/ranking.ts` — pure utilities: `getAverageSeed`, `sortSchoolsByDefaultRank`, `isRankingListLocked`,
  `getLockAt`
- API routes:
  - `GET  /api/ranking-lists` — list user's ranking lists for the active season
  - `POST /api/ranking-lists` — create + pre-populate; enforces lock; BEFORE_ROUND_OF_64 gates on First Four results
  - `GET  /api/ranking-lists/[id]` — full list with entries and school detail
  - `PATCH /api/ranking-lists/[id]` — rename (rejected when locked)
  - `DELETE /api/ranking-lists/[id]` — delete (blocked if submitted to a competition)
  - `PUT  /api/ranking-lists/[id]/entries` — atomic reorder via delete + re-create in one transaction
- Pre-population: schools sorted ascending by average NCAA seed, then alphabetically for ties
- Lock enforcement at the API layer — mutations rejected after `firstFourLockAt` or `roundOf64LockAt`
- Drag-to-reorder UI (`@dnd-kit/sortable`) with inline name editing, gender filter, school search, and Save button
- `/ranking` page — list of ranking lists with create / edit / delete
- `/ranking/[id]` page — full drag-and-drop editor
- `src/scripts/seed-test-season.ts` + `npm run seed:test` — seeds 53 realistic 2026 tournament schools
- Added `lucide-react` for icons
- Added `RankingListSummary`, `RankingListDetail`, `SchoolSummary`, `RankingEntryWithSchool` to shared types

---

## [0.1.0] — 2026-03-11

### Foundation

- Prisma v7 schema — all tables, relations, and indexes
- Shared TypeScript types (`/src/types`)
- Prisma client singleton with `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`)
- Auth.js v5 config — Google, Apple, and Microsoft OAuth (`src/lib/auth.ts`)
- Auth route handler (`src/app/api/auth/[...nextauth]/route.ts`)
- Middleware — protects authenticated routes (`src/middleware.ts`)
- Base layout and navigation shell (`src/app/layout.tsx`, `src/components/nav.tsx`)
- Environment variable documentation (`.env.example`)
- ESLint + Prettier configuration with Tailwind CSS plugin
- `.gitignore` covering credentials, generated files, and build artifacts

---

## Upcoming Milestones

| Milestone | Description                                                              | Target            |
| --------- | ------------------------------------------------------------------------ | ----------------- |
| **0.2.0** | Ranking Lists — create, reorder, save, lock enforcement                  | Before First Four |
| **0.3.0** | Core Domain Logic — bracket resolution + scoring engine + unit tests     | Before First Four |
| **0.4.0** | ESPN Import & Season Setup — API client, admin trigger, Vercel Cron      | Before First Four |
| **0.5.0** | Competitions — group play, invite tokens, competition lobby, dashboard   | Before First Four |
| **0.6.0** | Bracket Viewer & Leaderboard — scoring display, per-gender breakdown     | During tournament |
| **0.7.0** | Notifications & Polish — mobile layout, loading states, error boundaries | During tournament |
| **1.0.0** | Production Launch — Vercel + Railway, smoke test against live ESPN data  | TBD               |

---

[Unreleased]: https://github.com/your-org/march-madness/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/your-org/march-madness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/your-org/march-madness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/march-madness/releases/tag/v0.1.0
