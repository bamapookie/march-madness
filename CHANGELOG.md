# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.7.1] — 2026-03-15

### Post-Polish Fixes

- **Fix 1 — Join competition notification** — inline join server action on the lobby page now calls `createNotification`
  after creating the member row, so users receive a join confirmation matching what the API route provides.

- **Fix 2 — Remove misleading Correct Winner checkbox** — the disabled, always-checked checkbox next to the "Correct
  Winner" label in the competition create form has been removed. The label and "(always active)" note remain.

- **Fix 3 — `console.log` → `console.warn` in `import.ts`** — all seven `console.log` calls in `src/lib/import.ts`
  changed to `console.warn` to satisfy the project's ESLint `no-console` rule.

- **Fix 4 — Remove unnecessary `continue` in `discoverEspnGroupIds`** — the trailing `continue` at the end of the inner
  `try/catch` loop body removed; ESLint no longer flags it.

- **Fix 5 — Suppress pre-tournament score notifications** — `notifyScoresUpdated` now skips silently when every
  `EntryScore` row in the season has `totalScore = 0`, preventing spurious notifications during pre-tournament imports.

- **Fix 6 — Per-competition score notifications with leaderboard links** — `notifyScoresUpdated` restructured to group
  entries by competition. Each user receives one notification per competition that has at least one scored entry
  (`totalScore > 0`), linking directly to that competition's leaderboard (`/competition/[id]/leaderboard`).

- **Fix 7 — Grey out First Four points row for "Before Round of 64" lock mode** — when the organizer selects "Before
  Round of 64" in the competition create form, the First Four row in the unified points table is visually struck-through
  and all three inputs are disabled, with a tooltip explaining why.

- **Fix 8 — Admin link in navigation** — `src/components/nav.tsx` calls `isAdmin()` from `@/lib/admin` and renders a
  badged **Admin** link to `/admin` in both the desktop nav and the mobile drawer for admin users only.

- **Fix 9 — Join Cutoff UX improvements** — the Join Cutoff field moved from the Basic section to the Rules section,
  directly below Lock Mode. The `datetime-local` input now has a `max` constraint tied to the effective lock time
  (derived from the active season's `firstFourLockAt` / `roundOf64LockAt`). Switching lock modes clears a cutoff that
  would become invalid. A contextual hint below the input shows either the lock-close time (when no cutoff is set) or a
  human-readable time difference (e.g., "Cutoff is 2 days, 4 hours before the lock"). An error state prevents submission
  if the cutoff is set after the lock.

---

## [0.7.0] — 2026-03-15

### Notifications & Polish

- **In-app notifications** — `Notification` model wired end-to-end:
  - `src/lib/notifications.ts` — `createNotification` helper and `notifyScoresUpdated` (deduped per user per run)
  - `GET /api/notifications` — paginated list (20 newest); `PATCH` marks all read
  - `PATCH /api/notifications/[id]` marks one read; `DELETE` removes it
  - `src/components/nav-notifications.tsx` — bell icon with unread badge, dropdown list, mark-all-read; polls every 30 s
    (60 s when tab hidden)
  - Wired into `recomputeAllScores` (score-update notification) and `POST /api/competitions/join` (join confirmation)

- **Mobile-responsive layout**:
  - `src/components/nav.tsx` — desktop nav links hidden on `sm`; hamburger toggle via `MobileNavDrawer` client island
  - `src/components/mobile-nav-drawer.tsx` — drop-down panel with scroll lock; no third-party dependency
  - Notification bell always visible in top bar
  - Leaderboard table columns hidden on small screens (`Men's`, `Women's` hidden below `sm`; `Tiebreaker`, `Max Left`
    hidden below `md`)

- **Loading skeletons** — `loading.tsx` added to 9 route segments (dashboard, ranking, ranking/[id], competition,
  competition/[id], leaderboard, entries/[entryId], bracket/[id], admin); shared `src/components/ui/skeleton.tsx` helper

- **Error boundaries** — `error.tsx` added to the same 9 segments; shared `src/components/ui/error-boundary-content.tsx`
  with "Try again" + "← Go back"

- **Competition setup form overhaul**:
  - **Correct Winner always active** — removed its checkbox; guarded invariant in `validateCompetitionSettings` and
    default settings
  - **Seeding Accuracy Bonus** — replaced toggle switch with `<input type="checkbox">` for consistency with Round
    Advancement
  - **Unified points table** — merged three separate tables into one with Round, Correct Winner, Round Adv., and Seeding
    Bonus columns; disabled cells for inapplicable row/column pairs; `championship_runner_up` → "Championship
    (Runner-up)"; `championship_winner` → "Championship (Winner)"

- **Organizer delete competition** — `DELETE /api/competitions/[id]` (blocked when entries exist); "Delete Competition"
  link in organizer settings panel

- **Admin panel hardening**:
  - `GET /api/admin/db-status` — pings DB, returns latency; `src/components/admin/db-status-chip.tsx` shows live status
    chip
  - Last-successful-import timestamp promoted to heading subtitle
  - ESPN Configuration section consolidates tournament IDs and scoreboard group IDs into a single 2×2 grid
  - **ESPN group ID discovery** — `mensEspnGroupId` / `womensEspnGroupId` added to `TournamentSeason` (migration
    `20260315192834_add_espn_group_ids`); `discoverEspnGroupIds` in `import.ts` probes candidate IDs;
    `POST /api/admin/discover-group-ids` previews result; `getGroupId` helper falls back to hardcoded defaults (`"50"` /
    `"49"`) when season fields are null

### Bracket Viewer & Leaderboard

- Schema additions (migration `20260314212037_add_bracket_score_fields`):
  - `BracketSlot.isInProgress Boolean @default(false)` — set during import while a game is live; cleared on completion
  - `EntryScore.breakdownJson Json?` — per-method, per-gender point breakdown (`ScoreBreakdownJson` shape)
  - `EntryScore.maxPotentialRemaining Int?` — maximum additional points the entry could still earn

- `src/lib/scoring.ts` — implemented `recomputeAllScores`:
  - Resolves and caches `ResolvedBracket` (original bracket, set-once) for each locked entry
  - Applies `applyActualResults` for `reseed_by_ranking` competitions
  - Calls `scoreEntry` and upserts `EntryScore` with full breakdown and max potential
  - Max potential computed via three-case classification for reseeded brackets (Cases A/B/C)

- `src/lib/import.ts` — `importResults` now sets `BracketSlot.isInProgress = true` for live games, clears it on
  completion; drives the "In Progress" chip in the bracket viewer

- `src/types/index.ts` — added `ScoreBreakdownJson`, `LeaderboardEntry`, `LeaderboardResponse`, `EntryScoreDetail`,
  `EntryDetailResponse`, `BracketViewerResponse`

- New API routes:
  - `GET /api/competitions/[id]/leaderboard` — ranked entries with scores, max potential, tiebreaker
  - `GET /api/competitions/[id]/entries/[entryId]` — entry detail with resolved bracket, score breakdown, actuals
  - `GET /api/ranking-lists/[id]/bracket` — standalone bracket resolution for a ranking list

- `src/components/bracket/bracket-viewer.tsx` — `"use client"` component with Men's/Women's tabs, region grid, round
  columns, four chip states (✅ Correct / ❌ Wrong / 🔄 In Progress / ⬜ Upcoming)

- `src/app/competition/[id]/leaderboard/page.tsx` — ranked leaderboard table with Men's, Women's, total, max remaining,
  and tiebreaker columns; guarded by first-result check

- `src/app/competition/[id]/entries/[entryId]/page.tsx` — entry detail with score summary panel (total, breakdown by
  method, max remaining) and full bracket viewer with score overlays

- `src/app/bracket/[id]/page.tsx` — standalone bracket preview for a user's own ranking list

- Lobby wiring: "Leaderboard →" button appears once first game result exists; entry names link to detail page once
  leaderboard is available

- Ranking list card: added "Bracket" link to `/bracket/[id]`

---

## [0.5.0] — 2026-03-14

### Competitions (Group Play)

- Schema additions (migration `20260314055819_add_competition_join_code_and_cutoff`):
  - `Competition.joinCode String @unique` — 8-char hex join code, auto-generated at creation
  - `Competition.joinCutoffAt DateTime?` — optional cutoff; must be ≤ effective lock time
- `src/lib/competition.ts` — pure competition helpers:
  - `getDefaultCompetitionSettings` — sensible defaults for the creation form
  - `validateCompetitionSettings` — validates all required keys, types, and ranges
  - `getLockAtForCompetition` — maps `lock_mode` to the correct season timestamp
  - `isCompetitionLocked`, `isJoinCutoffPassed`, `isJoinable` — lifecycle predicates
  - `canViewCompetition` — access-control: pre-cutoff (public/member), post-cutoff (organizer + entry-holders)
  - `validateJoinCutoffAt` — ensures `joinCutoffAt ≤ lockAt`
- New shared types in `src/types/index.ts`:
  - `CompetitionSummary`, `CompetitionMemberSummary`, `CompetitionEntrySummary`, `CompetitionDetail`,
    `CompetitionUpdateInput`
- API routes:
  - `POST  /api/competitions` — create competition; auto-generates `joinCode`; organizer auto-joined
  - `GET   /api/competitions` — list competitions where the user is a member
  - `GET   /api/competitions/public` — public competitions browseable before cutoff (auth optional)
  - `GET   /api/competitions/[id]` — full `CompetitionDetail`; enforces access control
  - `PATCH /api/competitions/[id]` — organizer update (`isPublic`, `joinCutoffAt`); blocked after cutoff or lock
  - `POST  /api/competitions/[id]/rotate-code` — organizer-only; generates new `joinCode`; old code stops working
    immediately
  - `POST  /api/competitions/join` — join by `joinCode`; idempotent if already a member
  - `POST  /api/competitions/[id]/entries` — submit a ranking list; validates membership, lock, lock-mode match, and
    max-entries cap
  - `DELETE /api/competitions/[id]/entries/[entryId]` — member removes own entry pre-lock; organizer removes any entry
    pre-lock
- `src/app/join/[code]/page.tsx` — server component; redirects unauthenticated users; shows error cards for
  invalid/closed codes; performs join via server action; redirects to lobby
- `src/app/competition/create/page.tsx` + `src/components/competition/create-competition-form.tsx`:
  - Three-section creation form (Basic / Rules / Points)
  - Basic: name, description, public toggle, join cutoff
  - Rules: lock mode, reseed mode, max entries per user, scoring modes, seeding bonus toggle
  - Points: editable round-points tables for Round Advancement and Correct Winner; collapsible seeding bonus table
  - Submits to `POST /api/competitions` and redirects to the new lobby
- `src/app/competition/[id]/page.tsx` — competition lobby server component:
  - Access-control enforcement (redirects to `/competition` if unauthorized)
  - Status banner reflecting lifecycle state (Open / Private / Closed / Locked)
  - Join code chip with copy-invite-link button
  - Organizer settings panel (pre-cutoff only): toggle public, edit cutoff, rotate join code
  - Join button for non-members (pre-cutoff, pre-lock)
  - Submit Entry dropdown for members (pre-lock, under max cap)
  - Entries table with per-row remove button for organizer/owner pre-lock
  - Members list with avatars, names, entry count
  - Collapsible settings summary
- `src/components/competition/lobby-client.tsx` — client components: `LobbyOrganizerSettings`, `JoinCodeChip`,
  `SubmitEntryButton`, `EntriesTable`
- `src/app/competition/page.tsx` — replaced placeholder:
  - "My Competitions" section (authenticated users, fetched server-side)
  - "Browse Public Competitions" section (all visitors)
  - Uses `CompetitionCard` with status badge and countdown
  - "+ Create Competition" button for signed-in users
- `src/components/competition/competition-card.tsx` — competition summary card with status badge (Open/Closed/Locked),
  member/entry counts, organizer, and countdown
- `src/app/dashboard/page.tsx` — replaced placeholder:
  - Parallel queries for competitions and ranking lists
  - "My Competitions" section using `CompetitionCard`
  - "My Ranking Lists" section reusing `RankingListCard`
  - Empty states with call-to-action buttons
- Zero TypeScript errors; all pre-existing tests pass

---

## [0.4.0] — 2026-03-13

### ESPN Import & Season Setup

- `src/lib/import.ts` — ESPN API import library (no scheduler; called by cron route and dev script):
  - `fetchEspnJson<T>` — thin fetch wrapper; mocked in tests via `vi.spyOn`
  - `discoverTournamentId(gender)` — auto-discovers ESPN tournament ID by scanning the NCAA Tournament scoreboard for
    March dates; stores result on the `TournamentSeason` row
  - `importSchools(seasonId, gender, espnTournamentId)` — upserts `School` rows from the tournament bracket and enriches
    with `shortDisplayName`/`abbreviation` from the teams endpoint
  - `importBracketSlots(seasonId, gender, espnTournamentId)` — builds the full 4-region × 16-seed slot tree
    programmatically using fixed NCAA bracket rules; two-pass upsert sets `nextSlotId`; stores `espnEventId` on game
    slots for result matching
  - `importResults(seasonId, gender)` — fetches completed games from ESPN scoreboard, matches to bracket slots via
    `espnEventId`, upserts `TournamentResult` rows idempotently
  - `runFullImport(seasonId)` — orchestrates both genders; writes `ImportLog` on success or failure; calls
    `recomputeAllScores` stub (wired fully in 0.6.0)
- `src/lib/admin.ts` — `isAdmin(email)` helper; reads admin emails from `ADMIN_EMAILS` env var (comma-separated); no
  hard-coded addresses in source
- `src/lib/scoring.ts` — added `recomputeAllScores(_seasonId)` no-op stub for 0.6.0 wiring
- `src/types/espn.ts` — strict TypeScript interfaces for all ESPN API responses (no `any`): `EspnTeamsResponse`,
  `EspnScoreboardResponse`, `EspnTournamentResponse` and all sub-types
- `src/app/api/admin/import/route.ts` — `POST` route; admin-only; triggers `runFullImport`
- `src/app/api/admin/season/route.ts` — `PATCH` route; admin-only; updates `mensEspnTournamentId` and
  `womensEspnTournamentId` on the active season
- `src/app/api/cron/import-results/route.ts` — `GET` route; validated by `CRON_SECRET`; short-circuits outside the
  tournament window; calls `runFullImport`
- `vercel.json` — cron schedule `*/5 * * * *` pointing at `/api/cron/import-results`
- `src/scripts/import-results.ts` — dev script (`npm run import:results`); creates own Prisma client, finds active
  season, calls `runFullImport`, logs results
- `src/app/admin/page.tsx` — server component; redirects non-admins; loads season stats and last import log; passes
  serialized data to `AdminImportPanel`
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

[Unreleased]: https://github.com/your-org/march-madness/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/your-org/march-madness/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/your-org/march-madness/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/your-org/march-madness/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/your-org/march-madness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/march-madness/releases/tag/v0.1.0
