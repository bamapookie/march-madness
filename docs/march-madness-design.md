# March Madness Bracket App

Application Design Document

Version 1.1 • March 2026

## 1. Application Concept

This application allows users to build personalized ranking lists of all schools participating in the NCAA Men's and
Women's Basketball Tournaments. Each ranking list a user creates serves as their bracket prediction for both tournaments
simultaneously --- the higher-ranked school always advances when two schools meet.

### 1.1 Core Mechanic

- All schools fielding a team in either the Men's or Women's NCAA Tournament are pooled into a single combined field
- A school with both a Men's and Women's team occupies one slot in the ranking, and that ranking applies to both
  brackets
- The user orders this full field from best (#1) to worst, creating their personal ranking list
- New ranking lists are pre-populated in ascending order by each school's average NCAA seed across both tournaments.
  Schools in both tournaments use the average of their Men's and Women's seeds; schools in only one tournament use that
  seed directly. Ties are broken alphabetically by school name. Users reorder from this starting point.
- That ranking list is automatically resolved into both a Men's and Women's bracket using standard NCAA bracket
  structure (four regions) including the First Four play-in games
- In every matchup, the higher-ranked school advances --- no separate game-by-game picks are required
- The ranking locks at the competition's configured lock time and does not change.

### 1.2 Key Differentiators

- One ranking list generates two full brackets (Men's + Women's) automatically.
- Users compete on how well they ranked schools, not on picking games one by one.
- The combined bracket scoring rewards balanced knowledge across both tournaments.

## 2. User Features

### 2.1 Authentication

Authentication is handled entirely via OAuth --- no passwords are stored or managed by the application.

- Supported providers: Google, Apple, Microsoft
- Users are identified by their OAuth provider + user ID combination.
- Profile data (name, avatar) is pulled from the OAuth provider on first login and can be updated.
- Auth is handled by Auth.js v5 (`next-auth@5`); sessions are accessed server-side via `auth()`.

### 2.2 Ranking Lists

- Users may create multiple ranking lists per tournament season.
- Each list ranks the full combined field of tournament schools from 1 (best) to N (worst).
- New lists are pre-populated by average NCAA seed (ascending); users reorder from that starting point.
- The set of schools included depends on the competition's `lock_mode`:
  - `before_first_four` — all 68 Men's + 68 Women's teams (up to 136 schools total)
  - `before_round_of_64` — only the 64 Round of 64 qualifiers per gender (up to 128 schools); First Four results must be
    imported before ranking lists for such competitions can be created
- A ranking list automatically generates both a Men's and Women's bracket.
- Ranking lists lock at the competition's effective lock time and cannot be modified after that point.
- Users may name and manage their ranking lists from a personal dashboard.

### 2.3 Bracket Viewing

- Both the Men's and Women's brackets derived from a ranking list are viewable side-by-side
- Bracket views show all rounds including the First Four.
- After the tournament begins, actual results are overlaid on the bracket to show correct/incorrect predictions.
- Live scores and running totals update as tournament results are imported.

### 2.4 Competitions

- Users can create or join competitions.
- A competition is a group context in which participants' ranking lists are scored and ranked against each other.
- Users may enter one or more of their ranking lists into a competition, subject to the organizer's settings.
- Competitions have a leaderboard showing all participants ranked by total score.

## 3. Competition Configuration

Each competition is configured by its organizer. The following settings are available:

### 3.1 Access & Membership

| **Setting**            | **Options**                                 | **Description**                                                                                         |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Visibility**         | Public or Private                           | Public competitions appear in the lobby; private ones are hidden and require the join code              |
| **Max lists per user** | 1 or more (organizer sets limit)            | How many ranking lists a single user may enter                                                          |
| **Lock mode**          | `before_first_four` or `before_round_of_64` | When the ranking list locks; determines which lock timestamp from the season is used                    |
| **Join cutoff**        | Optional timestamp ≤ lock time              | If set, blocks new members after the cutoff; competition also disappears from public lobby after cutoff |
| **Join code**          | 8-char hex string, auto-generated           | Unique invite code per competition; used in `/join/[code]` URLs. Organizer may rotate before cutoff.    |

Every competition has a join code. Both public and private competitions can be joined via `/join/[code]` before the
cutoff. The code never changes automatically, but the organizer may rotate it before cutoff — the old code stops working
immediately for new joins, while existing members retain their membership.

### 3.2 Scoring Options

Organizers define scoring independently for each competition. Several scoring modes are available and may be combined.
The recommended point values decrease from Mode 1 → Bonus → Mode 2, but organizers may set any values they choose.

When `lock_mode = "before_round_of_64"`, no points are awarded for First Four games in any scoring mode; the
`first_four` keys in all point maps are ignored.

#### Mode 1: Correct Game Winner Points _(primary / traditional scoring)_

Points awarded for correctly predicting the winner of a specific game. This is the traditional bracket-challenge scoring
method and is recommended to be worth more than the other modes.

- Organizer sets a point value per correct game winner per round; a correct championship pick can be worth more than a
  correct Round of 64 pick.
- If a participant's bracket predicted School A to beat School B in the Round of 64, and that game actually resulted in
  School A winning, the participant earns points for that correct prediction.
- If reseeding is **disabled**: a matchup where an eliminated team was predicted to win earns no points — identical to
  how traditional bracket challenges work.
- If reseeding is **enabled**: when a predicted team is eliminated, future matchups are recalculated using the actual
  advancing teams and the user's original ranking order. Points for correct winners are still awarded based on those
  recalculated predictions.
  - _Example:_ A participant ranked an 8-team bracket 5, 6, 2, 1, 3, 4, 8, 7. The 8-seed upsets the 1-seed; the 4-seed
    beats the 5-seed. The 8-seed now plays the 4-seed. Because the participant originally ranked the 4-seed higher than
    the 8-seed, the 4-seed is the new predicted winner. If the 4-seed wins that game, the participant earns
    correct-winner points.

#### Bonus: Seeding Accuracy Points _(optional)_

Optional bonus points awarded when a school exits the tournament in the **exact** round predicted by the user's resolved
bracket. Recommended to be worth less than Mode 1 (Correct Winner) but more than Mode 2 (Round Advancement).

- Organizer enables/disables this mode and sets bonus values independently per round.
- The predicted exit round is determined by bracket resolution — the round a school is predicted to **lose** in is their
  target round.
- A school must reach the predicted round and then **lose** there to earn the bonus. Advancing past the predicted round
  forfeits the bonus.
- "Winning the championship" is treated as its own exit point: `championship_winner` bonus is awarded only if the team
  actually wins the title; `championship_runner_up` bonus is awarded only to the actual runner-up.
- This bonus uses the **original** ranking predictions, not any reseeded matchups.

#### Mode 2: Round Advancement Points _(supplemental)_

Points awarded for each game a school **wins**, capped at the rounds where the original bracket predicted them to win.
Recommended to be worth less than both Mode 1 and the Seeding Accuracy Bonus.

- Organizer sets a point value for winning a game in each round (First Four through Championship).
- Points are cumulative: a team predicted to lose in the Elite 8 earns points for winning their Round of 64 game, Round
  of 32 game, and Sweet 16 game (the three rounds they were originally predicted to win). The Elite 8 is their predicted
  loss round and earns no Round Advancement points.
- Points are awarded based on the **original** ranking predictions only; teams that inherit a slot via reseeding do not
  earn round advancement points for that inherited slot.
- This mode is only meaningfully distinct from Correct Winner when `reseed_mode = "reseed_by_ranking"` is active. When
  reseeding is disabled, the two modes produce equivalent results; organizers should not combine them in that case.

### 3.3 Reseeding Options

When an upset occurs (a lower-ranked school defeats a higher-ranked school), subsequent rounds can be handled in one of
two ways:

| **Mode**                                        | **Behavior**                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slot-based (no reseed)**                      | The upset winner inherits the eliminated team's bracket slot. The user's ranking still determines all subsequent matchups in that slot. Matchups where both predicted teams are still alive are unchanged.                                                                                                                                                                          |
| **Reseed by original ranking**                  | After each round's real results are imported, any future predicted matchup where one or more teams have been eliminated is updated: the eliminated team is replaced by the actual advancing team, and the matchup winner is re-evaluated by comparing the two teams' positions in the user's original ranking. Matchups where both predicted teams are still alive are not changed. |
| **Organizer selects one mode per competition.** | This applies to both the Men's and Women's brackets equally.                                                                                                                                                                                                                                                                                                                        |

### 3.4 Tiebreaking

When two participants have identical total scores, the tiebreaker is resolved as follows:

- Primary tiebreaker: The participant whose Men's and Women's bracket scores are closer together (smaller absolute
  difference) wins. This rewards balanced knowledge across both tournaments.
- If the difference is also equal, participants share the rank.

### 3.5 Competition Lifecycle

Competitions move through four states based on the configured cutoff time and lock time:

1. **Pre-cutoff** — open period. `isPublic = true` competitions appear in the public lobby and anyone can join.
   `isPublic = false` competitions are hidden; joining requires the join code. Organizer may update `isPublic` and
   `joinCutoffAt`, and may remove any entry.
2. **Post-cutoff / pre-lock** — joining is closed. The competition disappears from the public lobby regardless of
   `isPublic`. Only the organizer and members who have submitted ≥1 entry may view the lobby. Organizer may still remove
   entries; members may still add or remove their own entries up to the lock time.
3. **Locked** — no entries may be added or removed by anyone, including the organizer. No settings changes permitted.
   Access is the same as post-cutoff.
4. **Tournament in progress / complete** — same access rules as locked. Scores update as results are imported.

If no `joinCutoffAt` is set, the competition transitions directly from Pre-cutoff to Locked at the lock time.

## 4. Data Model

### 4.1 Entity Overview

| **Entity**          | **Key Fields**                                                                                        | **Notes**                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| users               | id, name, email, avatar_url, oauth_provider, oauth_id                                                 | One record per person regardless of OAuth provider used       |
| tournament_seasons  | id, year, first_four_lock_at, round_of_64_lock_at, mens_espn_tournament_id, womens_espn_tournament_id | Stores both lock timestamps; ESPN tournament IDs set by admin |
| schools             | id, name, conference, has_mens_team, has_womens_team                                                  | Populated from tournament field each year via ESPN import     |
| bracket_slots       | id, season_id, gender, region, round, slot_number, school_id, espn_event_id                           | Official NCAA bracket placement; First Four included          |
| ranking_lists       | id, user_id, season_id, name, locked, created_at                                                      | One per user-created ranking; max unlimited per user          |
| ranking_entries     | id, ranking_list_id, school_id, rank_position                                                         | Ordered list of schools 1..N for a given ranking list         |
| competitions        | id, name, creator_id, season_id, is_public, join_code, join_cutoff_at, settings_json                  | join_code auto-generated; join_cutoff_at optional             |
| competition_members | id, competition_id, user_id, joined_at                                                                | Membership record; separate from entries                      |
| competition_entries | id, competition_id, user_id, ranking_list_id                                                          | Submitted ranking list for a competition                      |
| tournament_results  | id, season_id, gender, round, slot_number, winner_school_id, played_at                                | Auto-imported from ESPN API                                   |
| import_logs         | id, season_id, status, started_at, completed_at, error_message                                        | Tracks each ESPN import run; surfaced in admin panel          |
| invitations         | id, competition_id, inviter_id, invitee_email, token, status, expires_at                              | Invite tokens for private competitions                        |
| notifications       | id, user_id, type, payload_json, read, created_at                                                     | In-app only; no email                                         |

### 4.2 Competition Settings JSON Schema

The `settings_json` column on `competitions` stores all scoring/reseeding configuration. Note that `join_code` and
`join_cutoff_at` are separate columns on the `Competition` model — they are not part of `settings_json`.

```json
{
  "max_lists_per_user": 1,
  "lock_mode": "before_first_four",
  "scoring_mode": ["correct_winner", "round_advancement"],
  "seeding_bonus_enabled": true,
  "seeding_bonus_points": {
    "first_four": 0,
    "round_of_64": 0,
    "round_of_32": 3,
    "sweet_16": 5,
    "elite_8": 8,
    "final_four": 13,
    "championship_runner_up": 18,
    "championship_winner": 25
  },
  "reseed_mode": "fixed",
  "round_points": {
    "first_four": 1,
    "round_of_64": 2,
    "round_of_32": 4,
    "sweet_16": 8,
    "elite_8": 16,
    "final_four": 32,
    "championship": 64
  },
  "correct_winner_points": {
    "first_four": 1,
    "round_of_64": 2,
    "round_of_32": 4,
    "sweet_16": 8,
    "elite_8": 16,
    "final_four": 32,
    "championship": 64
  }
}
```

## 5. Bracket Resolution Logic

### 5.1 Generating a Bracket from a Ranking List

When a user creates or updates their ranking list (before lock), the system resolves both brackets as follows:

- Step 1: Load the official bracket slots for the season (First Four through Championship) for each gender.
- Step 2: For each First Four matchup, identify the two schools in those slots and compare their positions in the user's
  ranking list. The lower rank number (higher-ranked school) advances to the Round of 64 slot.
- Step 3: Proceed round by round. In each matchup, the school with the lower rank number in the user's list advances.
- Step 4: If `reseed_by_ranking` is enabled for a competition, after each round's actual results are imported, scan all
  future predicted matchups. For any matchup where one or more teams have been eliminated in reality, replace the
  eliminated team with the actual advancing team and re-evaluate the matchup winner by comparing the two teams'
  positions in the user's original ranking. Matchups where both predicted teams are still alive are not changed.
- Step 5: Store the resolved bracket. Do not recompute on every read.

### 5.2 Scoring a Bracket

After actual tournament results are imported, scores are computed in three independent modes and summed:

- **Correct winner scoring** _(primary)_: for each game played, compare the predicted winner against the actual winner.
  Award `correct_winner_points[round]` for each correct prediction. With reseeding disabled, a game where the predicted
  winner was already eliminated earns 0 points. With reseeding enabled, use the updated (reseeded) predictions when
  checking for correct winners.
- **Seeding accuracy bonus** _(optional)_: award `seeding_bonus_points[round]` when a school exits the tournament in the
  exact round predicted by the user's original resolved bracket. A school that advances past their predicted exit round
  earns no bonus. Uses original predictions only — not reseeded matchups. `championship_winner` and
  `championship_runner_up` are tracked separately.
- **Round advancement scoring** _(supplemental)_: for each school that is an original slot occupant (not a reseeded
  replacement), award `round_points[round]` for each game they win in rounds where the original bracket predicted them
  to win (i.e., rounds before their predicted exit). Points are cumulative — a team predicted to lose in the Elite 8
  earns `round_of_64` + `round_of_32` + `sweet_16` points (the three games they were predicted to win). The Elite 8 is
  their predicted loss round and earns no Round Advancement points. Based on original predictions only.
- Combined score = Men's bracket score + Women's bracket score.
- Tiebreaker value = `|Men's score − Women's score|` (smaller is better).
- Scores are recomputed and cached after each results import; they are not recomputed on every leaderboard read.

## 6. External Data Integration

### 6.1 Tournament Field Import

Prior to the tournament, an admin triggers an import from the ESPN API to populate the `schools` and `bracket_slots`
tables for the new season. The following ESPN endpoints are used:

- **Team/School Reference Data:**
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500`
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams?limit=500`
- **Tournament Bracket:**
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/{tournamentId}`
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/tournaments/{tournamentId}`
  - The tournament ID is auto-discovered from the scoreboard endpoint and stored on the season row.

This import is triggered manually by an admin and reviewed before the season is marked active. No API key is required;
the ESPN API endpoints are publicly accessible.

### 6.2 Live Results Import

Once the tournament begins, game results are polled from the ESPN API automatically via Vercel Cron Jobs.

- **Source:** ESPN API (sole source)
- **Scoreboard endpoints:**
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`
    - Query params: `groups=50` (NCAA Tournament), `limit=100`, `dates=YYYYMMDD`
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard`
    - Query params: `groups=49` (NCAA Tournament), `limit=100`, `dates=YYYYMMDD`
- **Game summary (for detailed results):**
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={gameId}`
  - `GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/summary?event={gameId}`
- **Polling schedule:** every 5 minutes during active tournament windows; hourly otherwise. Schedule defined in
  `vercel.json`; the cron route calls the import function and is protected by `CRON_SECRET`.
- Results are written to `tournament_results`. Bracket scores and leaderboards are recomputed on each successful import.
- Import failures are logged to `import_logs` and retried; stale data is surfaced to admins via an in-app warning.

## 7. Technology Stack

| **Layer**      | **Technology**                    | **Rationale**                                                                              |
| -------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend       | Next.js (App Router)              | SSR + static generation, built-in API routes, co-located backend                           |
| Backend API    | Next.js API Routes                | Co-located with frontend, reduces operational complexity at this scale                     |
| Database       | PostgreSQL (Railway)              | Relational model fits bracket/competition data; strong JSON support for settings_json      |
| ORM            | Prisma                            | Type-safe schema management, migration tooling, works well with Next.js                    |
| Auth           | Auth.js v5 (`next-auth@5`)        | Supports Google, Apple, and Microsoft OAuth; no password management; `AUTH_SECRET` env var |
| Results Import | Vercel Cron Jobs polling ESPN API | Native Vercel scheduling; no separate infrastructure needed                                |
| Hosting (App)  | Vercel                            | Native Next.js deployment, auto-scaling                                                    |
| Hosting (DB)   | Railway                           | Plain PostgreSQL; no inactivity pauses; standard `DATABASE_URL` works with Prisma          |
| Notifications  | In-app only (DB-backed)           | Notifications table polled client-side; no email infrastructure needed                     |

### 7.1 OAuth Configuration

Each OAuth provider requires app registration:

- Google: Google Cloud Console → OAuth 2.0 credential (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- Apple: Apple Developer Portal → Sign In with Apple service ID
- Microsoft: Azure Portal → App registration with Microsoft identity platform

All three providers are configured as Auth.js v5 providers with client ID and secret stored in environment variables.
Admin access is controlled via the `ADMIN_EMAILS` environment variable (comma-separated list of email addresses); no
admin role is stored in the database.

## 8. Infrastructure & Hosting

### 8.1 Small Scale (Personal / Friends Group, \<500 users)

| **Resource**     | **Service**                | **Estimated Monthly Cost** |
| ---------------- | -------------------------- | -------------------------- |
| Frontend + API   | Vercel Hobby               | Free                       |
| PostgreSQL       | Railway Starter            | ~\$5                       |
| Results Cron Job | Vercel Cron                | Included                   |
| OAuth            | Google / Apple / Microsoft | Free (basic use)           |
| **Total**        |                            | **~\$5/month**             |

### 8.2 Medium Scale (Hundreds to Low Thousands of Users)

| **Resource**                  | **Service** | **Estimated Monthly Cost** |
| ----------------------------- | ----------- | -------------------------- |
| Frontend + API                | Vercel Pro  | \$20                       |
| PostgreSQL                    | Railway     | \$10--\$25                 |
| Cron / Background Jobs Worker | Vercel Cron | Included                   |
| **Total**                     |             | **~\$30-\$45/month**       |

### 8.3 Data Persistence Strategy

- All application state (users, rankings, brackets, competitions, results) lives in PostgreSQL on Railway.
- Bracket resolution is computed and stored — not recalculated on every read — for performance.
- Scores are recomputed and cached in a scores summary table after each results import.
- Database backups: daily automated backups via Railway; 7-day retention minimum.
- The ranking list and all entries are immutable after the lock time. No edits are permitted post-lock.

## 9. Application Screen Inventory

| **Screen**                     | **Description**                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Landing / Login                | OAuth login with Google, Apple, Microsoft. Brief app description. Tournament status banner.                       |
| Dashboard                      | User's ranking lists, active competitions, notifications feed, tournament season status.                          |
| Create / Edit Ranking List     | Drag-and-drop interface to order all tournament schools. Save, name, and preview both brackets.                   |
| Bracket Viewer                 | Side-by-side Men's and Women's bracket visualization derived from a ranking list. Highlights actual results.      |
| Competition Lobby              | Competition details, leaderboard, participant list, entry management, join code display, lock countdown.          |
| Create Competition             | Form to configure all competition settings (scoring, reseeding, visibility, lock mode, max entries).              |
| Public Competition List        | Browseable list of public competitions open for joining (hidden after join cutoff).                               |
| Join via Code (`/join/[code]`) | Landing page for invite links. Accepts join code from URL; handles join flow or prompts login.                    |
| Leaderboard                    | Ranked list of participants in a competition with scores, tiebreaker values, and bracket links.                   |
| Admin Panel                    | Manage tournament season, trigger ESPN import, monitor import status (logs, stale-data warnings), ESPN ID editor. |
| Notifications                  | In-app notification center: competition invites, score updates, join alerts.                                      |
| Profile                        | User profile, linked OAuth accounts, list of all ranking lists and competitions.                                  |

## 10. Design Decisions

All open design questions from the initial document have been resolved. Decisions are recorded in `CLAUDE.md` under the
**Resolved Questions** section. Key resolved items include:

- **ESPN API** — sole source for both tournament field and live results; no API key required
- **Multi-season** — fresh deployment each year; data model supports multi-season for future use
- **Admin access** — `ADMIN_EMAILS` environment variable; no DB role required
- **Tiebreaker** — absolute difference between Men's and Women's bracket scores (smaller is better)
- **Auth library** — Auth.js v5 (`next-auth@5`); `AUTH_SECRET` env var
- **Cron mechanism** — Vercel Cron Jobs; `src/lib/import.ts` is a plain function with no scheduler
- **Database host** — Railway (PostgreSQL); no Supabase
- **Lock mode** — organizer-configurable: `before_first_four` or `before_round_of_64`
- **Ranking list pre-population** — ascending by average NCAA seed; ties broken alphabetically
- **Reseeding** — partial adjustment only (matchups with two live teams are never changed)
- **Seeding bonus for championship** — `championship_winner` and `championship_runner_up` are separate bonus keys

_End of Design Document_
