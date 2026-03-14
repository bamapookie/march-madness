# March Madness Bracket App

## Project Overview

A web app where users rank all schools in the NCAA Men's and Women's Basketball Tournaments in a single unified list.
That one ranking list automatically resolves into both a Men's and Women's bracket — the higher-ranked school always
wins every matchup. No game-by-game picks.

Users compete in groups (competitions) where organizers configure scoring, reseeding rules, and entry limits. The app
scores both brackets together as a combined total.

---

## Milestones

Selection Sunday is **March 15, 2026**. First Four begins **~March 19**. Round of 64 begins **~March 20**. Milestones
0.1–0.5 must be complete before First Four tip-off. 0.6–0.7 can ship during the tournament.

### 0.1.0 — Foundation ✅ _complete_

- Prisma schema — all tables, relations, indexes
- Shared TypeScript types (`/types`)
- Prisma client singleton (`src/lib/db.ts`)
- Auth.js v5 config — Google, Apple, Microsoft OAuth (`src/lib/auth.ts`)
- Auth route handler (`src/app/api/auth/[...nextauth]/route.ts`)
- Middleware — protect authenticated routes (`src/middleware.ts`)
- Base layout and navigation shell
- Environment variable documentation (`.env.example`)

### 0.2.0 — Ranking Lists ✅ _complete_

- API routes — create, read, update ranking list and entries
- Ranking list pre-population by average NCAA seed
- Lock enforcement at the API layer (reject mutations after `lock_at`)
- Ranking list UI — drag-to-reorder, save, view (`src/app/ranking`)

### 0.3.0 — Core Domain Logic ✅ _complete_

- Bracket resolution — slot-based and reseed_by_ranking (`src/lib/bracket.ts`)
- Scoring engine — round advancement, correct winner, seeding accuracy bonus (`src/lib/scoring.ts`)
- Unit tests for both (50 tests, 2 files)

### 0.4.0 — ESPN Import & Season Setup ✅ _complete_

- ESPN API client — schools, bracket slots, scoreboard, tournament results (`src/lib/import.ts`)
- `discoverTournamentId` — auto-discovers ESPN tournament ID from scoreboard; stores on season row
- Admin API route — manual import trigger (`src/app/api/admin/import/route.ts`)
- Admin season route — update ESPN tournament IDs (`src/app/api/admin/season/route.ts`)
- Vercel Cron Job — scheduled polling (`src/app/api/cron/import-results/route.ts`, `vercel.json`)
- Dev script — `npm run import:results` (`src/scripts/import-results.ts`)
- Admin page — import status, stale data warnings, ESPN ID editor, manual trigger (`src/app/admin`)
- `src/lib/admin.ts` — `isAdmin()` helper driven by `ADMIN_EMAILS` env var
- `src/types/espn.ts` — strict ESPN API response types (no `any`)
- Schema additions: `mensEspnTournamentId`/`womensEspnTournamentId` on `TournamentSeason`; `espnEventId` on
  `BracketSlot`; new `ImportLog` model with `ImportStatus` enum

### 0.5.0 — Competitions _(group play)_ ✅ _complete_

- API routes — create competition, join, submit ranking list entry, organizer update
- Join code — auto-generated per competition; used in invite URLs (`/join/[code]`)
- Optional join cutoff time — blocks new members after cutoff; must be ≤ lock time
- Competitions become effectively private at cutoff regardless of `isPublic` setting
- Public lobby — public competitions browseable by anyone before cutoff (`/competition`)
- Organizer controls — change `isPublic` and `joinCutoffAt` before cutoff; remove entries before lock
- Post-cutoff access — only organizer + members with ≥1 submitted entry can view the lobby
- Competition creation form with full settings (scoring mode, lock mode, points, reseed mode)
- Competition lobby — members, submitted entries, lock countdown, join code display (`src/app/competition`)
- Dashboard — user's competitions and ranking lists (`src/app/dashboard`)
- Schema additions: `joinCode String @unique` and `joinCutoffAt DateTime?` on `Competition`

### 0.6.0 — Bracket Viewer & Leaderboard _(scoring display)_

- Resolved bracket viewer — Men's and Women's side by side (`src/app/bracket`)
- Score computation triggered on each results import
- Leaderboard with combined score, tiebreaker, and per-gender breakdown
- Competition entry detail — user's bracket vs. actual results

### 0.7.0 — Notifications & Polish

- In-app notifications — polled client-side, displayed in nav
- Mobile-responsive layout pass
- Loading states, error boundaries, empty states
- Admin panel hardening — Railway DB status, last import timestamp

### 1.0.0 — Production Launch

- Production deployment — Vercel + Railway
- All environment variables configured in Vercel dashboard
- Vercel Cron Job verified in production
- End-to-end smoke test against live ESPN data

---

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Framework      | Next.js (App Router)                        |
| Language       | TypeScript (strict mode)                    |
| Database       | PostgreSQL                                  |
| ORM            | Prisma                                      |
| Auth           | Auth.js v5 (Google, Apple, Microsoft OAuth) |
| Hosting        | Vercel (app) + Railway (DB)                 |
| Results import | Vercel Cron Jobs polling ESPN API           |
| Notifications  | In-app only (no email)                      |

---

## Project Structure

```
/src                    # Source code
  /app                  # Next.js App Router pages and layouts
    /api                # API route handlers
      /cron             # Vercel Cron Job route handlers
    /(auth)             # Login / OAuth callback pages
    /dashboard          # User dashboard
    /ranking            # Create/edit ranking list
    /bracket            # Bracket viewer
    /competition        # Competition lobby, leaderboard, create
    /admin              # Admin panel
  /components           # Shared React components
  /generated
    /prisma             # Auto-generated Prisma client (gitignored; rebuilt on deploy)
      client.ts         # Main import: import { PrismaClient } from "@/generated/prisma/client"
  /lib
    /db.ts              # Prisma client singleton (uses @prisma/adapter-pg driver adapter)
    /auth.ts            # Auth.js v5 config — exports { auth, signIn, signOut, handlers }
    /bracket.ts         # Bracket resolution logic
    /scoring.ts         # Scoring logic
    /import.ts          # ESPN API import logic (plain async fn, no scheduler)
  /middleware.ts        # Auth middleware — export { auth as middleware } from "@/lib/auth"
  /types                # Shared TypeScript types
/prisma
  schema.prisma         # Database schema (models + enums; no datasource URL)
  /migrations           # Prisma migration files
prisma.config.ts        # Prisma v7 config — datasource URL + migrations path
```

---

## Key Commands

```bash
# Development
npm run dev               # Start dev server (localhost:3000)

# Database
npx prisma migrate dev    # Run migrations in development
npx prisma migrate deploy # Run migrations in production
npx prisma studio         # Open Prisma DB browser
npx prisma generate       # Regenerate Prisma client after schema changes
                          # Note: also runs automatically via "prisma generate && next build"

# Testing
npm run test              # Run test suite
npm run lint              # ESLint check
npm run typecheck         # TypeScript type check
npm run format            # Prettier — format all files
npm run format:check      # Prettier — check formatting (CI)

# Results import (manual trigger for testing)
npm run import:results

# Development data seeding
npm run seed:test         # Seed a 2026 season + 53 test schools (local dev only)
```

> **Prisma v7 notes:** The schema has no `datasource url` — the connection string lives in `prisma.config.ts` (used by
> CLI) and is passed at runtime via `@prisma/adapter-pg` in `src/lib/db.ts`. The generated client is in
> `src/generated/prisma/` (gitignored) and is rebuilt on every deploy via the `build` script.

---

## Data Model (Key Entities)

```
users                  — OAuth-authenticated users (no passwords)
tournament_seasons     — Active season with first_four_lock_at and round_of_64_lock_at timestamps
schools                — All teams in Men's and/or Women's tournament
bracket_slots          — Official NCAA bracket positions (region/round/slot)
ranking_lists          — A user's ordered list of schools (1 = best)
ranking_entries        — Individual school positions within a ranking list
competitions           — Group contest with organizer-defined settings
competition_members    — Users who have joined a competition
competition_entries    — Ranking lists submitted to a competition
tournament_results     — Auto-imported actual game outcomes
invitations            — Invite tokens for private competitions
notifications          — In-app notifications (polled client-side)
```

### Important Relationships

- One `ranking_list` → many `ranking_entries` (one per school, ordered 1..N)
- One `ranking_list` → resolves into one Men's bracket + one Women's bracket
- One `competition` → many `competition_entries` (subject to `max_lists_per_user`)
- One `school` → one slot in a user's ranking (even if in both Men's + Women's tournaments)

---

## Core Domain Concepts

**Ranking list:** The user's ordered list of all tournament schools. This IS their bracket prediction. No separate picks
needed.

**Ranking list pre-population:** When a user creates a new ranking list, it is pre-filled with all tournament schools
sorted ascending by their average NCAA seed across both tournaments. Schools appearing in both Men's and Women's
tournaments use the average of their two seeds; schools in only one tournament use that seed directly. Ties are broken
alphabetically by school name. Users may then reorder from this starting point.

- If `lock_mode = "before_first_four"`: the list includes all 68 Men's + 68 Women's teams (up to 136 schools total)
- If `lock_mode = "before_round_of_64"`: the list includes only the 64 Round of 64 qualifiers per gender (up to 128
  schools total); First Four results must be imported before ranking lists can be created

**Bracket resolution:** Given a ranking list and the official NCAA bracket slots, simulate every game by advancing the
school with the lower rank number (higher rank = smaller number). Includes First Four play-in games.

**Fixed bracket (`reseed_mode = "fixed"`):** The predicted bracket is never updated. When real results deviate from
predictions, eliminated teams' future game slots simply earn no points.

**Reseeding (by original ranking):** When real results eliminate a team that was predicted to appear in a future
matchup, the actual advancing team replaces them in that slot. The matchup winner is then re-evaluated by comparing the
two teams' rank positions in the user's original ranking. Only matchups involving at least one eliminated team are
updated; matchups where both predicted teams are still alive retain their original prediction.

**Scoring — round advancement:** Points for each game a school wins in rounds where the original bracket predicted them
to win, based on original bracket resolution. Uses the same per-round map semantics as Correct Winner. Gives additional
scoring weight to original predictions independently of how reseeding updates game-slot matchups.

**Scoring — correct winner:** Points for correctly predicting the winner of each specific game.

**Seeding accuracy bonus:** Bonus points when a school exits the tournament in the exact round the user's resolved
bracket predicted — including a separate bonus for correctly predicting the championship winner.

**Tiebreaker:** When scores are tied, the user whose Men's and Women's bracket scores have the smaller absolute
difference wins. Rewards balanced knowledge across both tournaments.

**Competition lifecycle:** Competitions move through four states:

1. **Pre-cutoff** — open period. `isPublic = true` competitions appear in the public lobby and anyone can join.
   `isPublic = false` competitions are hidden; joining requires the join code. Organizer may update `isPublic` and
   `joinCutoffAt`, and may remove any entry.
2. **Post-cutoff / pre-lock** — joining is closed. The competition disappears from the public lobby regardless of
   `isPublic`. Only the organizer and members who have submitted ≥1 entry may view the lobby. Organizer may still remove
   entries. Members may still add or remove their own entries up to the lock time.
3. **Locked** — no entries may be added or removed by anyone, including the organizer. No settings changes permitted.
   Access is the same as post-cutoff.
4. **Tournament in progress / complete** — same access rules as locked.

**Join code:** Every competition has a unique `joinCode` (8-char hex string, auto-generated at creation). The invite URL
is `/join/[joinCode]`. Both public and private competitions can be joined this way (before cutoff). The code never
changes automatically, but the organizer may rotate it before the cutoff — the old code immediately stops working for
new joins, while all existing members retain their membership. Members who have already submitted at least one entry may
continue submitting up to the `max_lists_per_user` limit without needing the new code; they are already members.

**Join cutoff (`joinCutoffAt`):** Optional timestamp set by the organizer. If set, it must be ≤ the competition's
effective lock time. After cutoff: no new joins, competition hidden from public lobby, access restricted to organizer +
entry-holders. Organizer may no longer change settings after cutoff.

---

## Competition Settings (settings_json shape)

> In addition to `settingsJson`, the `Competition` model also stores `joinCode String @unique` (auto-generated, never
> changes) and `joinCutoffAt DateTime?` (optional; must be ≤ lock time).

```typescript
type CompetitionSettings = {
  max_lists_per_user: number;
  lock_mode: "before_first_four" | "before_round_of_64";
  scoring_mode: Array<"round_advancement" | "correct_winner">;
  seeding_bonus_enabled: boolean;
  seeding_bonus_points: SeedingBonusPointMap;
  reseed_mode: "fixed" | "reseed_by_ranking";
  round_points: RoundPointMap;
  correct_winner_points: RoundPointMap;
};

// Used for round_points and correct_winner_points.
// Each key represents points for *winning* a game in that round.
// round_points is capped at the team's predicted exit round (games they were predicted to win).
// "championship" = winning the championship game; for round_points this only applies
// to teams originally predicted to win the championship.
type RoundPointMap = {
  first_four: number;
  round_of_64: number;
  round_of_32: number;
  sweet_16: number;
  elite_8: number;
  final_four: number;
  championship: number;
};

// Used for seeding_bonus_points.
// Distinguishes between losing in the championship game vs. winning it,
// since "winning the championship" is its own predicted exit point.
type SeedingBonusPointMap = {
  first_four: number;
  round_of_64: number;
  round_of_32: number;
  sweet_16: number;
  elite_8: number;
  final_four: number;
  championship_runner_up: number; // predicted to lose in the championship game
  championship_winner: number; // predicted to win the championship
};
```

---

## Auth

- Auth.js v5 (`next-auth@5`) handles all OAuth flows
- Providers: Google, Apple, Microsoft
- No passwords stored anywhere
- User identity = `oauth_provider` + `oauth_id` combination
- Session contains: `user.id`, `user.name`, `user.email`, `user.avatar_url`
- Config lives in `src/lib/auth.ts`, exports `{ auth, signIn, signOut, handlers }`
- Route handler at `src/app/api/auth/[...nextauth]/route.ts` re-exports `handlers`
- Server components use `const session = await auth()` — no `getServerSession()`
- Middleware uses `export { auth as middleware } from "@/lib/auth"` in `src/middleware.ts`
- Requires `AUTH_SECRET` env var (replaces `NEXTAUTH_SECRET`)

---

## Bracket Resolution Rules

1. Load official `bracket_slots` for the season and gender
2. Resolve First Four: compare rank positions of the two schools in each play-in slot; lower number advances
3. Resolve each subsequent round the same way
4. If `reseed_mode = "reseed_by_ranking"`: after each round's actual results import, scan all future predicted matchups.
   For any matchup where one or more teams have been eliminated in reality, replace the eliminated team with the actual
   advancing team and re-evaluate the matchup winner by comparing the two teams' rank positions in the user's original
   ranking. Matchups where both predicted teams are still alive are not changed.
5. Store the resolved bracket — do not recompute on every read

---

## Scoring Rules

- Compute after each `tournament_results` import
- Combined score = Men's score + Women's score
- Cache results in a scores summary table; do not recompute on every leaderboard read
- Tiebreaker value = `Math.abs(mens_score - womens_score)` — lower is better
- Points are earned based on `competition_settings` for each competition entry:
  - When `lock_mode = "before_round_of_64"`: no points are awarded for First Four games in any scoring mode;
    `first_four` values in all point maps are ignored.
  - Correct Winner Points: awarded for each game where the predicted winner matches the actual winner.
    - This is the traditional method of scoring points for tournament brackets, and thus **should** be worth more than
      Round Advancement Bonus or Seeding Bonus to reward correct game-by-game predictions. The organizer is under no
      obligation to follow this recommendation.
    - Organizer sets the points for each round in the competition settings, so a correct pick in the championship game
      can be worth more than a correct pick in the first round.
    - If a participant's bracket predicted School A to beat School B in the Round of 64, and that game actually resulted
      in School A winning, the participant earns points for that correct prediction.
    - When `reseed_mode = "fixed"`, scoring predictions are not updated, so a matchup where an eliminated team was
      predicted to win will simply not earn points. This is the traditional method of scoring brackets, where if a
      selected team is eliminated, all of that team's future predicted matchups are wrong and earn no points.
    - If reseeding is enabled, and a participant's predicted winner of a matchup is eliminated, later rounds are
      recalculated based on the surviving teams, but points for correct winners are still awarded based on the original
      rankings.
      - For example, if a participant predicted an 8 team bracket with the official seeds ranked 5, 6, 2, 1, 3, 4, 8, 7,
        and the 8 seed beats the 1 seed, and the 4 seed beats the 5 seed, then the 8 seed will play the 4 seed in the
        next round. Since the participant originally ranked the 4 seed higher than the 8 seed, the participant's
        predicted winner of that matchup would be the 4 seed. If the 4 seed then beats the 8 seed, the participant would
        earn points for that matchup since their predicted winner (the 4 seed) won.
  - Seeding Accuracy Bonus: awarded when a team exits the tournament in the exact round predicted by the user's resolved
    bracket.
    - The predicted exit round is determined by running bracket resolution against the user's ranking — whichever round
      a team is predicted to lose in is their target round.
    - "Winning the championship" is its own exit point: a team predicted to win it all earns `championship_winner` bonus
      points only if they actually win the championship.
    - A team predicted to lose in the championship game earns `championship_runner_up` bonus points only if they are the
      actual runner-up.
    - Requires that the team NOT advance past the round predicted for elimination.
    - For example, if a user ranked a team #1 (predicting they win the championship) but they lose in the Elite 8, they
      would NOT earn the seeding accuracy bonus.
    - It is recommended that this value be less than the correct winner points, but not required.
    - This bonus is based on the original ranking position of the teams, not on reseeded teams.
  - Round Advancement Bonus: awarded for each game a team wins, for rounds where the original bracket predicted them to
    win.
    - The predicted exit round is determined by the original bracket resolution against the user's ranking — the round a
      team was predicted to _lose_ in. Points are earned for each game won in rounds before that predicted exit.
    - Uses the same per-round map semantics as Correct Winner Points: `round_points.round_of_64` is earned for winning a
      Round of 64 game, `round_points.round_of_32` for winning a Round of 32 game, and so on — but only for rounds where
      the team was originally predicted to win.
    - A team predicted to lose in the Elite 8 earns Round of 64 + Round of 32 + Sweet 16 points (the games they were
      predicted to win). The Elite 8 is the predicted loss round and earns no Round Advancement points.
    - Points are only awarded based on the original bracket resolution — teams that inherit slots through reseeding do
      not earn round advancement bonus points.
    - This mode is only meaningful when `reseed_mode = "reseed_by_ranking"` is active. When `reseed_mode = "fixed"`,
      scoring predictions are not updated and Round Advancement produces results equivalent to Correct Winner, so
      organizers should not use both modes simultaneously unless using `reseed_by_ranking`.
    - When `lock_mode = "before_round_of_64"`: no First Four points are awarded (same as other modes).
    - Organizer sets the points per round in the competition settings.
      - It is recommended that this value be less than correct winner points, but not required.

---

## Results Import

- Source: ESPN API (primary)
- Polling via Vercel Cron Jobs — schedule defined in `vercel.json`, calling `GET /api/cron/import-results`
  - Every 5 minutes during active tournament windows
  - Hourly otherwise
  - Route is protected by `CRON_SECRET` env var, validated against Vercel's injected `Authorization` header
  - `src/lib/import.ts` is a plain async function with no scheduler logic — it is called by the cron API route and by
    the `npm run import:results` dev script
- Failures: log and retry; surface stale data warning to admins in-app
- On each successful import: recompute bracket scores and update leaderboard cache

---

## Coding Conventions

- TypeScript strict mode — no `any` types
- Use Prisma client for all DB access — no raw SQL unless necessary
- API routes return `{ data, error }` shaped responses
- All bracket and scoring logic lives in `/lib` — keep it pure and testable
- Server components by default; use `"use client"` only where needed
- Ranking lists and entries are **immutable after `lock_at`** — enforce this at the API layer, not just the UI

---

## Documentation Maintenance

Documentation must be kept in sync with the code. This applies to every session, and is especially required when a
milestone is delivered.

### Files to update

| File                           | When to update                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                    | Any time a milestone is completed, an open question is resolved, a new convention is established, or a key architectural decision is made |
| `CHANGELOG.md`                 | On every milestone delivery — move the milestone from _In Progress_ to a dated release entry listing all additions                        |
| `README.md`                    | When commands, environment variables, getting-started steps, or the milestone status table change                                         |
| `docs/march-madness-design.md` | When a resolved question changes a design decision, a new feature changes the data model or screen inventory, or the tech stack changes   |

### Rules

- **Mark milestones complete** — when a milestone ships, update `CLAUDE.md` to `✅ _complete_` add a full entry to
  `CHANGELOG.md`, and update the version in package.json.
- **Resolve open questions in place** — when an open question in `CLAUDE.md` is answered (by the user or by
  implementation), mark it `[x]` and record the answer inline. Never delete answered questions.
- **Keep Key Commands accurate** — if a new `npm run` script is added or changed, update the Key Commands section in
  both `CLAUDE.md` and `README.md`.
- **Commit docs with the code** — documentation changes must be committed in the same session as the code changes they
  describe, not deferred to a later commit.
- **Commit after every prompt** — at the end of every response, stage all modified files and produce a single commit
  with a short, descriptive message summarizing what changed. Leave the working tree clean before yielding back to the
  user.
- **No stale milestone status** — the milestone status table in `README.md` must match the `✅ / 🔲` state of the
  milestones in `CLAUDE.md` at all times.

---

## Resolved Questions

- [x] Which ESPN API endpoint / key will be used for live results?
  - No key needed. APIs are internal, but are commonly used and documented.
    - Endpoints:
      - Scoreboard:
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard`
        - Query Params:
          - dates=20260315 — filter by date (YYYYMMDD)
          - groups=50 — NCAA Tournament group ID for Men's
          - groups=49 — NCAA Tournament group ID for Women's
          - limit=100 — number of events per page
      - Tournament Bracket:
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/{tournamentId}`
      - Team/School Reference Data:
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500`
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams?limit=500`
      - Specific Game Summary:
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={gameId}`
        - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event={gameId}`
- [x] Multi-season support, or fresh deployment each year?
  - Fresh deployment each year. Data model supports multi-season, but initial launch will focus on a single season to
    reduce complexity.
- [x] How is admin access granted — hard-coded email or DB role?
  - For the initial release, admin access is driven by the `ADMIN_EMAILS` environment variable (comma-separated list of
    email addresses). `src/lib/admin.ts` exports `isAdmin(email)` which reads this variable at runtime. This avoids
    hard-coded values in source code and allows easy configuration in Vercel without a code deploy. In the future, we
    could add an `is_admin` flag to the `users` table and build an admin management UI.
- [x] Finals score prediction bonus tiebreaker?
  - Yes, the tiebreaker will be based on the absolute difference between the Men's and Women's bracket scores. The user
    with the smaller difference wins the tiebreaker.
- [x] Launch timeline relative to Selection Sunday?
  - The goal is to have a working MVP ready by Selection Sunday (March 15, 2026). This will allow us to onboard users
    and have the app ready for the start of the tournament. We can continue to iterate and add features during the
    tournament as needed.
- [x] Polling mechanism — Vercel Cron Jobs or node-cron?
  - Vercel Cron Jobs. Schedules defined in `vercel.json`, calling a protected API route at `/api/cron/import-results`.
    `src/lib/import.ts` contains only a plain async function with no scheduler logic.
- [x] Auth.js version — v4 or v5?
  - Auth.js v5 (`next-auth@5`). Uses `AUTH_SECRET` env var, `auth()` for session access in server components, and
    `export { auth as middleware }` pattern in `src/middleware.ts`.
- [x] Seeding accuracy bonus for the championship winner?
  - "Winning the championship" is treated as its own exit point with a separately configurable bonus
    (`championship_winner`), distinct from losing in the championship game (`championship_runner_up`). Both are keys in
    `SeedingBonusPointMap`.
- [x] Ranking list pre-population — does the user start from a blank list, or a list pre-ordered by NCAA seed?
  - Pre-populated in ascending order by each school's average NCAA seed across both tournaments. Schools in both
    tournaments use the average of their Men's and Women's seeds; schools in only one tournament use that seed directly.
    Ties broken alphabetically by school name. Users reorder from this starting point.
- [x] First Four lock timing — does `lock_at` fall before the First Four games, or before the Round of 64?
  - Competition organizers choose via `lock_mode` in `CompetitionSettings`. `tournament_seasons` stores both
    `first_four_lock_at` and `round_of_64_lock_at` timestamps (set by admin). Each competition enforces the timestamp
    matching its chosen `lock_mode`. When `lock_mode = "before_round_of_64"`, no First Four points are awarded in any
    scoring mode and ranking lists are built from the 64 Round of 64 qualifiers only.
- [x] `reseed_by_ranking` mode — full re-resolution or partial adjustment?
  - Partial adjustment only. After each round's real results are imported, any future predicted matchup where one or
    more teams have been eliminated is updated: the eliminated team is replaced with the actual advancing team, and the
    matchup winner is re-evaluated using the two teams' rank positions in the user's original ranking. Matchups where
    both predicted teams are still alive are not changed.
- [x] Database host — Supabase or Railway?
  - Railway. Plain PostgreSQL, no extra connection pooling config required, no inactivity pauses, and no unused platform
    features. Standard `DATABASE_URL` connection string works with Prisma out of the box.
- [x] Round Advancement Bonus — what is its purpose, and how does it differ from Correct Winner?
  - Its purpose is to give additional scoring weight to original predictions independently of how `reseed_by_ranking`
    updates game-slot matchups. CW evaluates the (possibly reseeded) predicted winner of each specific game slot; RA
    always tracks original predicted team advancement, capped at the predicted exit round. They are only meaningfully
    distinct when `reseed_mode = "reseed_by_ranking"` is active. When `reseed_mode = "fixed"`, scoring predictions are
    not updated and RA produces equivalent results to CW; organizers should not combine both modes in that case.

## External Configuration

These configuration steps occur outside the project and likely require human intervention to implement. They are
documented here to track their progress and to provide steps that would likely need to be repeated if setting up a
separate development environment. They should be added to the readme section on development environment setup.

- [x] Set up Google Authentication.
  - I already have a Google Cloud Account, so I don't have the setup steps for that. Just be aware that if some things
    don't work dor some unknown reason, it is usually because there is a legal notice somewhere that you didn't accept.
    That has burned me before.
  - Set up a new Project in the Google Cloud Console, if you don't already have one that you want to use.
  - Go to the "APIs & Services" > "OAuth Consent Screen" page for your project. It will take you to the Google Auth
    Platform Overview.
  - Go to the Branding tab and fill in the required fields. You can add your email and a product name, but you don't
    need to fill in any of the other fields for testing purposes. (You can't use localhost here anyway.)
  - Note that the App Name from this page will be shown on the Google sign-in prompt, so make it descriptive of your
    app. If you provide privacy policy and terms of service URLs, those will be shown on the consent screen as well.
  - Save and continue, then back to the dashboard.
  - Go to the "APIs & Services" > "Credentials" page for your project.
  - Click "Create Credentials" > "OAuth client ID".
  - Select "Web application" as the application type.
  - Add `http://localhost:3000` to the "Authorized JavaScript origins".
  - Add `http://localhost:3000/api/auth/callback/google` to the "Authorized redirect URIs".
  - Click "Create" and note the generated Client ID and Client Secret. These will be used in the `GOOGLE_CLIENT_ID` and
    `GOOGLE_CLIENT_SECRET` environment variables.
- [ ] Set up Apple Authentication.
- [ ] Set up Microsoft Authentication.
- [ ] Create Vercel project and configure environment variables.
- [ ] Create Railway project, provision PostgreSQL database, and connect it to Vercel.
- [x] Set up PostgreSQL locally for development and create a `.env.local` with the connection string.
  - I used a docker image for this.
    ```shell
    docker pull dhi.io/postgres:18-alpine3.22-dev
    docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres  dhi.io/postgres:18-alpine3.22-dev
    # Use the connection string `postgresql://postgres:postgres@localhost:5432/march-madness` in `.env.local`
    ```
- [x] Connect to the ESPN API and verify that results can be imported successfully.
