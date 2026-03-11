# March Madness Bracket App

## Project Overview

A web app where users rank all schools in the NCAA Men's and Women's Basketball Tournaments in a single unified list. That one ranking list automatically resolves into both a Men's and Women's bracket — the higher-ranked school always wins every matchup. No game-by-game picks.

Users compete in groups (competitions) where organizers configure scoring, reseeding rules, and entry limits. The app scores both brackets together as a combined total.

---

## Tech Stack

| Layer          | Technology                                   |
|----------------|----------------------------------------------|
| Framework      | Next.js (App Router)                         |
| Language       | TypeScript (strict mode)                     |
| Database       | PostgreSQL                                   |
| ORM            | Prisma                                       |
| Auth           | NextAuth.js (Google, Apple, Microsoft OAuth) |
| Hosting        | Vercel (app) + Supabase or Railway (DB)      |
| Results import | node-cron polling ESPN API                   |
| Notifications  | In-app only (no email)                       |

---

## Project Structure

```
/src                    # Source code
  /app                  # Next.js App Router pages and layouts
    /api                # API route handlers
    /(auth)             # Login / OAuth callback pages
    /dashboard          # User dashboard
    /ranking            # Create/edit ranking list
    /bracket            # Bracket viewer
    /competition        # Competition lobby, leaderboard, create
    /admin              # Admin panel
  /components           # Shared React components
  /lib
    /db.ts              # Prisma client singleton
    /auth.ts            # NextAuth config
    /bracket.ts         # Bracket resolution logic
    /scoring.ts         # Scoring logic
    /import.ts          # ESPN API import logic
  /prisma
    schema.prisma       # Database schema
    /migrations         # Prisma migration files
  /types                # Shared TypeScript types
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

# Testing
npm run test              # Run test suite
npm run lint              # ESLint check
npm run typecheck         # TypeScript type check

# Results import (manual trigger for testing)
npm run import:results
```

---

## Data Model (Key Entities)

```
users                  — OAuth-authenticated users (no passwords)
tournament_seasons     — Active season with lock_at timestamp
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

**Bracket resolution:** Given a ranking list and the official NCAA bracket slots, simulate every game by advancing the school with the lower rank number (higher rank = smaller number). Includes First Four play-in games.

**Reseeding (slot-based):** After an upset, the winning school inherits the loser's bracket slot and continues from there.

**Reseeding (by original ranking):** After each round, surviving schools are redistributed into fresh bracket seeds based on their original rank position.

**Scoring — round advancement:** Points for correctly predicting a school reaches a given round, regardless of path.

**Scoring — correct winner:** Points for correctly predicting the winner of each specific game.

**Seeding accuracy bonus:** Bonus points when a school reaches the exact round the user's ranking predicted.

**Tiebreaker:** When scores are tied, the user whose Men's and Women's bracket scores have the smaller absolute difference wins. Rewards balanced knowledge across both tournaments.

---

## Competition Settings (settings_json shape)

```typescript
type CompetitionSettings = {
  max_lists_per_user: number;
  scoring_mode: Array<"round_advancement" | "correct_winner">;
  seeding_bonus_enabled: boolean;
  seeding_bonus_points: number;
  reseed_mode: "slot_based" | "reseed_by_ranking";
  round_points: RoundPointMap;
  correct_winner_points: RoundPointMap;
};

type RoundPointMap = {
  first_four: number;
  round_of_64: number;
  round_of_32: number;
  sweet_16: number;
  elite_8: number;
  final_four: number;
  championship: number;
};
```

---

## Auth

- NextAuth.js handles all OAuth flows
- Providers: Google, Apple, Microsoft
- No passwords stored anywhere
- User identity = `oauth_provider` + `oauth_id` combination
- Session contains: `user.id`, `user.name`, `user.email`, `user.avatar_url`

---

## Bracket Resolution Rules

1. Load official `bracket_slots` for the season and gender
2. Resolve First Four: compare rank positions of the two schools in each play-in slot; lower number advances
3. Resolve each subsequent round the same way
4. If `reseed_mode = "reseed_by_ranking"`: after each round's actual results import, redistribute surviving schools by original rank before resolving the next predicted round
5. Store the resolved bracket — do not recompute on every read

---

## Scoring Rules

- Compute after each `tournament_results` import
- Combined score = Men's score + Women's score
- Cache results in a scores summary table; do not recompute on every leaderboard read
- Tiebreaker value = `Math.abs(mens_score - womens_score)` — lower is better
- Points are earned based on `competition_settings` for each competition entry:
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
   - Seeding accuracy bonus: awarded when a team is eliminated in the exact round predicted by the user's ranking position
     - Requires that the team NOT advance past the round predicted for elimination.
     - For example, if a user ranked a team #1 (predicting they win the championship) but they lose in the Elite 8, they would NOT earn the seeding accuracy bonus.
     - It is recommended that this value be less than the Correct winner points.
     - This bonus is based on the original ranking position of the teams, not on reseeded teams.

---

## Results Import

- Source: ESPN API (primary)
- Polling: every 5 minutes during active tournament windows, hourly otherwise
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

## Open Questions (resolve before implementing)

- [x] Which ESPN API endpoint / key will be used for live results?
   - No key needed.  APIs are internal, but are commonly used and documented.
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
   - Fresh deployment each year.  Data model supports multi-season, but initial launch will focus on a single season to reduce complexity.
- [x] How is admin access granted — hard-coded email or DB role?
  - For the initial release, admin access will be based on code and backend access.  There will be no UI for managing admin users.  In the future, we could add an `is_admin` flag to the `users` table and build an admin management UI.
- [x] Finals score prediction bonus tiebreaker? tie-breaker should reward users who have more balanced knowledge across both tournaments, rather than just picking all the winners in one and hoping for a tiebreaker.
   - Yes, the tiebreaker will be based on the absolute difference between the Men's and Women's bracket scores.  The user with the smaller difference wins the tiebreaker.
- [x] Launch timeline relative to Selection Sunday?  Disney said everybody needs deadlines.
   - The goal is to have a working MVP ready by Selection Sunday (March 17, 2024).  This will allow us to onboard users and have the app ready for the start of the tournament.  We can continue to iterate and add features during the tournament as needed.