# March Madness Bracket App

## Project Overview

A web app where users rank all schools in the NCAA Men's and Women's Basketball Tournaments in a single unified list. That one ranking list automatically resolves into both a Men's and Women's bracket — the higher-ranked school always wins every matchup. No game-by-game picks.

Users compete in groups (competitions) where organizers configure scoring, reseeding rules, and entry limits. The app scores both brackets together as a combined total.

---

## Milestones

Selection Sunday is **March 15, 2026**. First Four begins **~March 19**. Round of 64 begins **~March 20**.
Milestones 0.1–0.5 must be complete before First Four tip-off. 0.6–0.7 can ship during the tournament.

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

### 0.3.0 — Core Domain Logic _(pure, testable, no DB)_

- Bracket resolution — slot-based and reseed_by_ranking (`src/lib/bracket.ts`)
- Scoring engine — round advancement, correct winner, seeding accuracy bonus (`src/lib/scoring.ts`)
- Unit tests for both

### 0.4.0 — ESPN Import & Season Setup _(data foundation)_

- ESPN API client — schools, bracket slots, scoreboard, tournament results (`src/lib/import.ts`)
- Admin API route — manual import trigger (`src/app/api/admin/import/route.ts`)
- Vercel Cron Job — scheduled polling (`src/app/api/cron/import-results/route.ts`, `vercel.json`)
- Dev script — `npm run import:results` (`src/scripts/import-results.ts`)
- Admin page — import status, stale data warnings, manual trigger (`src/app/admin`)

### 0.5.0 — Competitions _(group play)_

- API routes — create competition, join, submit ranking list entry
- Invite token generation and redemption
- Competition creation form with full settings (scoring mode, lock mode, points, reseed mode)
- Competition lobby — members, submitted entries, lock countdown (`src/app/competition`)
- Dashboard — user's competitions and ranking lists (`src/app/dashboard`)

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

> **Prisma v7 notes:** The schema has no `datasource url` — the connection string lives in
> `prisma.config.ts` (used by CLI) and is passed at runtime via `@prisma/adapter-pg` in
> `src/lib/db.ts`. The generated client is in `src/generated/prisma/` (gitignored) and is
> rebuilt on every deploy via the `build` script.

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

**Ranking list:** The user's ordered list of all tournament schools. This IS their bracket prediction. No separate picks needed.

**Ranking list pre-population:** When a user creates a new ranking list, it is pre-filled with all tournament schools sorted ascending by their average NCAA seed across both tournaments. Schools appearing in both Men's and Women's tournaments use the average of their two seeds; schools in only one tournament use that seed directly. Ties are broken alphabetically by school name. Users may then reorder from this starting point.

- If `lock_mode = "before_first_four"`: the list includes all 68 Men's + 68 Women's teams (up to 136 schools total)
- If `lock_mode = "before_round_of_64"`: the list includes only the 64 Round of 64 qualifiers per gender (up to 128 schools total); First Four results must be imported before ranking lists can be created

**Bracket resolution:** Given a ranking list and the official NCAA bracket slots, simulate every game by advancing the school with the lower rank number (higher rank = smaller number). Includes First Four play-in games.

**Reseeding (slot-based):** After an upset, the winning school inherits the loser's bracket slot and continues from there.

**Reseeding (by original ranking):** When real results eliminate a team that was predicted to appear in a future matchup, the actual advancing team replaces them in that slot. The matchup winner is then re-evaluated by comparing the two teams' rank positions in the user's original ranking. Only matchups involving at least one eliminated team are updated; matchups where both predicted teams are still alive retain their original prediction.

**Scoring — round advancement:** Points for correctly predicting a school reaches a given round, regardless of path.

**Scoring — correct winner:** Points for correctly predicting the winner of each specific game.

**Seeding accuracy bonus:** Bonus points when a school exits the tournament in the exact round the user's resolved bracket predicted — including a separate bonus for correctly predicting the championship winner.

**Tiebreaker:** When scores are tied, the user whose Men's and Women's bracket scores have the smaller absolute difference wins. Rewards balanced knowledge across both tournaments.

---

## Competition Settings (settings_json shape)

```typescript
type CompetitionSettings = {
  max_lists_per_user: number;
  lock_mode: "before_first_four" | "before_round_of_64";
  scoring_mode: Array<"round_advancement" | "correct_winner">;
  seeding_bonus_enabled: boolean;
  seeding_bonus_points: SeedingBonusPointMap;
  reseed_mode: "slot_based" | "reseed_by_ranking";
  round_points: RoundPointMap;
  correct_winner_points: RoundPointMap;
};

// Used for round_points and correct_winner_points.
// "championship" covers both the winner and loser of the championship game.
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
4. If `reseed_mode = "reseed_by_ranking"`: after each round's actual results import, scan all future predicted matchups. For any matchup where one or more teams have been eliminated in reality, replace the eliminated team with the actual advancing team and re-evaluate the matchup winner by comparing the two teams' rank positions in the user's original ranking. Matchups where both predicted teams are still alive are not changed.
5. Store the resolved bracket — do not recompute on every read

---

## Scoring Rules

- Compute after each `tournament_results` import
- Combined score = Men's score + Women's score
- Cache results in a scores summary table; do not recompute on every leaderboard read
- Tiebreaker value = `Math.abs(mens_score - womens_score)` — lower is better
- Points are earned based on `competition_settings` for each competition entry:
  - When `lock_mode = "before_round_of_64"`: no points are awarded for First Four games in any scoring mode; `first_four` values in all point maps are ignored
  - Round advancement points: awarded for each school that reaches the predicted round or beyond.
    - Points are only awarded for the original team in the slot, not for any team that later inherits that slot due to reseeding
    - No points for the first round (Round of 64) since all teams start there, except for the First Four play-in games which can earn points if predicted correctly
    - Points are awarded for each round reached, so if a team reaches the Elite 8, they earn points for Round of 32, Sweet 16, and Elite 8
    - Organizer may select the points for each round in the competition settings.
      - It is recommended that this value be less than the Seeding accuracy bonus.
  - Correct winner points: awarded for each game where the predicted winner matches the actual winner
    - Organizer sets the points for each round in the competition settings, so a correct pick in the championship game can be worth more than a correct pick in the first round.
    - If a participant's bracket predicted School A to beat School B in the Round of 64, and that game actually resulted in School A winning, the participant earns points for that correct prediction.
    - If reseeding is enabled, and a participant's predicted winner of a matchup is eliminated, later rounds are recalculated based on the surviving teams, but points for correct winners are still awarded based on the original rankings.
      - For example, if a participant predicted an 8 team bracket with the official seeds ranked 5, 6, 2, 1, 3, 4, 8, 7, and the 8 seed beats the 1 seed, and the 4 seed beats the 5 seed, then the 8 seed will play the 4 seed in the next round. Since the participant originally ranked the 4 seed higher than the 8 seed, the participant's predicted winner of that matchup would be the 4 seed. If the 4 seed then beats the 8 seed, the participant would earn points for that matchup since their predicted winner (the 4 seed) won.
    - If reseeding is disabled, then a matchup where an eliminated team was predicted to win would simply not earn points.
  - Seeding accuracy bonus: awarded when a team exits the tournament in the exact round predicted by the user's resolved bracket
    - The predicted exit round is determined by running bracket resolution against the user's ranking — whichever round a team is predicted to lose in is their target round
    - "Winning the championship" is its own exit point: a team predicted to win it all earns `championship_winner` bonus points only if they actually win the championship
    - A team predicted to lose in the championship game earns `championship_runner_up` bonus points only if they are the actual runner-up
    - Requires that the team NOT advance past the round predicted for elimination
    - For example, if a user ranked a team #1 (predicting they win the championship) but they lose in the Elite 8, they would NOT earn the seeding accuracy bonus
    - It is recommended that this value be less than the Correct winner points
    - This bonus is based on the original ranking position of the teams, not on reseeded teams

---

## Results Import

- Source: ESPN API (primary)
- Polling via Vercel Cron Jobs — schedule defined in `vercel.json`, calling `GET /api/cron/import-results`
  - Every 5 minutes during active tournament windows
  - Hourly otherwise
  - Route is protected by `CRON_SECRET` env var, validated against Vercel's injected `Authorization` header
  - `src/lib/import.ts` is a plain async function with no scheduler logic — it is called by the cron API route and by the `npm run import:results` dev script
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

Documentation must be kept in sync with the code. This applies to every session, and is especially required when a milestone is delivered.

### Files to update

| File | When to update |
| --- | --- |
| `CLAUDE.md` | Any time a milestone is completed, an open question is resolved, a new convention is established, or a key architectural decision is made |
| `CHANGELOG.md` | On every milestone delivery — move the milestone from *In Progress* to a dated release entry listing all additions |
| `README.md` | When commands, environment variables, getting-started steps, or the milestone status table change |

### Rules

- **Mark milestones complete** — when a milestone ships, update `CLAUDE.md` to `✅ _complete_` and add a full entry to `CHANGELOG.md`.
- **Resolve open questions in place** — when an open question in `CLAUDE.md` is answered (by the user or by implementation), mark it `[x]` and record the answer inline. Never delete answered questions.
- **Keep Key Commands accurate** — if a new `npm run` script is added or changed, update the Key Commands section in both `CLAUDE.md` and `README.md`.
- **Commit docs with the code** — documentation changes must be committed in the same session as the code changes they describe, not deferred to a later commit.
- **No stale milestone status** — the milestone status table in `README.md` must match the `✅ / 🔲` state of the milestones in `CLAUDE.md` at all times.

---

## Open Questions (resolve before implementing)

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
  - Fresh deployment each year. Data model supports multi-season, but initial launch will focus on a single season to reduce complexity.
- [x] How is admin access granted — hard-coded email or DB role?
  - For the initial release, admin access will be based on code and backend access. There will be no UI for managing admin users. In the future, we could add an `is_admin` flag to the `users` table and build an admin management UI.
- [x] Finals score prediction bonus tiebreaker?
  - Yes, the tiebreaker will be based on the absolute difference between the Men's and Women's bracket scores. The user with the smaller difference wins the tiebreaker.
- [x] Launch timeline relative to Selection Sunday?
  - The goal is to have a working MVP ready by Selection Sunday (March 15, 2026). This will allow us to onboard users and have the app ready for the start of the tournament. We can continue to iterate and add features during the tournament as needed.
- [x] Polling mechanism — Vercel Cron Jobs or node-cron?
  - Vercel Cron Jobs. Schedules defined in `vercel.json`, calling a protected API route at `/api/cron/import-results`. `src/lib/import.ts` contains only a plain async function with no scheduler logic.
- [x] Auth.js version — v4 or v5?
  - Auth.js v5 (`next-auth@5`). Uses `AUTH_SECRET` env var, `auth()` for session access in server components, and `export { auth as middleware }` pattern in `src/middleware.ts`.
- [x] Seeding accuracy bonus for the championship winner?
  - "Winning the championship" is treated as its own exit point with a separately configurable bonus (`championship_winner`), distinct from losing in the championship game (`championship_runner_up`). Both are keys in `SeedingBonusPointMap`.
- [x] Ranking list pre-population — does the user start from a blank list, or a list pre-ordered by NCAA seed?
  - Pre-populated in ascending order by each school's average NCAA seed across both tournaments. Schools in both tournaments use the average of their Men's and Women's seeds; schools in only one tournament use that seed directly. Ties broken alphabetically by school name. Users reorder from this starting point.
- [x] First Four lock timing — does `lock_at` fall before the First Four games, or before the Round of 64?
  - Competition organizers choose via `lock_mode` in `CompetitionSettings`. `tournament_seasons` stores both `first_four_lock_at` and `round_of_64_lock_at` timestamps (set by admin). Each competition enforces the timestamp matching its chosen `lock_mode`. When `lock_mode = "before_round_of_64"`, no First Four points are awarded in any scoring mode and ranking lists are built from the 64 Round of 64 qualifiers only.
- [x] `reseed_by_ranking` mode — full re-resolution or partial adjustment?
  - Partial adjustment only. After each round's real results are imported, any future predicted matchup where one or more teams have been eliminated is updated: the eliminated team is replaced with the actual advancing team, and the matchup winner is re-evaluated using the two teams' rank positions in the user's original ranking. Matchups where both predicted teams are still alive are not changed.
- [x] Database host — Supabase or Railway?
  - Railway. Plain PostgreSQL, no extra connection pooling config required, no inactivity pauses, and no unused platform features. Standard `DATABASE_URL` connection string works with Prisma out of the box.

```

```
