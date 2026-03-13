# March Madness Bracket App

Application Design Document

Version 1.0 • March 2026

## 1. Application Concept

This application allows users to build personalized ranking lists of all schools participating in the NCAA Men's and
Women's Basketball Tournaments. Each ranking list a user creates serves as their bracket prediction for both tournaments
simultaneously --- the higher-ranked school always advances when two schools meet.

### 1.1 Core Mechanic

- All schools fielding a team in either the Men's or Women's NCAA Tournament are pooled into a single combined field
- A school with both a Men's and Women's team occupies one slot in the ranking, and that ranking applies to both
  brackets
- The user orders this full field from best (#1) to worst, creating their personal ranking list
- That ranking list is automatically resolved into both a Men's and Women's bracket using standard NCAA bracket
  structure (four regions) including the First Four play-in games
- In every matchup, the higher-ranked school advances --- no separate game-by-game picks are required
- The ranking locks at tournament start and does not change.

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

### 2.2 Ranking Lists

- Users may create multiple ranking lists per tournament season.
- Each list ranks the full combined field of tournament schools from 1 (best) to N (worst).
- A ranking list automatically generates both a Men's and Women's bracket.
- Ranking lists lock at the official tournament start time and cannot be modified after that point.
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

| **Setting**            | **Options**                                          | **Description**                                                 |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| **Visibility**         | Public (join via link) or <br/>Private (invite-only) | Controls who can discover and <br/>join the competition         |
| **Max lists per user** | 1 or more <br/>(organizer sets limit)                | How many ranking lists <br/>a single user may enter             |
| **Join deadline**      | Locks at tournament start                            | All competitions lock at tournament <br/>start; no late entries |

### 3.2 Scoring Options

Organizers define scoring independently for each competition. Several scoring modes are available and may be combined.
The recommended point values decrease from Mode 1 → Bonus → Mode 2, but organizers may set any values they choose.

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

Points awarded for correctly predicting that a school reaches a given round, regardless of path. Recommended to be worth
less than both Mode 1 and the Seeding Accuracy Bonus.

- Organizer sets a point value for each round (First Four through Championship).
- Points are cumulative: a school reaching the Elite 8 earns points for Round of 32, Sweet 16, and Elite 8.
- No points are awarded for simply reaching the Round of 64 — all teams start there.
- First Four points are only applicable when the competition locks before the First Four games are played.
- Points are awarded based on the **original** ranking predictions only; teams that inherit a slot via reseeding do not
  earn round advancement points for that slot.

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

## 4. Data Model

### 4.1 Entity Overview

| **Entity**          | **Key Fields**                                                           | **Notes**                                               |
| ------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| users               | id, name, email, avatar_url, oauth_provider, oauth_id                    | One record per person regardless of OAuth provider used |
| tournament_seasons  | id, year, mens_start_at, womens_start_at, lock_a                         | Defines the active season window; locks all brackets    |
| schools             | id, name, conference, has_mens_team, has_womens_team                     | Populated from tournament field each year               |
| bracket_slots       | id, season_id, gender, region, round, slot_number, school_id             | Official NCAA bracket placement; First Four included    |
| ranking_lists       | id, user_id, season_id, name, locked, created_at                         | One per user-created ranking; max unlimited per user    |
| ranking_entries     | id, ranking_list_id, school_id, rank_position                            | Ordered list of schools 1..N for a given ranking list   |
| competitions        | id, name, creator_id, season_id, is_public, settings_json                | settings_json holds all scoring/reseeding config        |
| competition_members | id, competition_id, user_id, joined_at                                   | Membership record; separate from entries                |
| competition_entries | id, competition_id, user_id, ranking_list_id                             | Submitted ranking list for a competition                |
| tournament_results  | id, season_id, gender, round, slot_number, winner_school_id, played_a    | Auto-imported from external source                      |
| invitations         | id, competition_id, inviter_id, invitee_email, token, status, expires_at | Invite-only competitions                                |
| notifications       | id, user_id, type, payload_json, read, created_at                        | In-app only; no email                                   |

### 4.2 Competition Settings JSON Schema

The settings_json column on competitions stores all configurable options:

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
    "round_of_64": 0,
    "round_of_32": 2,
    "sweet_16": 3,
    "elite_8": 5,
    "final_four": 8,
    "championship": 13
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
  replacement), award `round_points[round]` for each round they actually reach beyond the Round of 64. Points are
  cumulative (a Sweet 16 appearance earns Round of 32 + Sweet 16 points). Based on original predictions only.
- Combined score = Men's bracket score + Women's bracket score.
- Tiebreaker value = `|Men's score − Women's score|` (smaller is better).

## 6. External Data Integration

### 6.1 Tournament Field Import

Prior to the tournament, an admin triggers an import to populate the schools and bracket_slots tables for the new
season. Potential sources:

- NCAA.com official bracket data
- ESPN API (bracket and team data endpoints)
- Sports-reference.com structured data

This import is a one-time action per season and is reviewed by an admin before the season is marked active.

### 6.2 Live Results Import

Once the tournament begins, game results are polled and imported automatically. Options:

- ESPN API: Provides live scores and final results for both Men's and Women's tournaments.
- Polling interval: every 5 minutes during tournament windows; hourly otherwise.
- Results are written to tournament_results. Bracket scores and leaderboards are recomputed on each import.
- Import failures are logged and retried; stale data is surfaced to admins via an in-app warning.

## 7. Recommended Technology Stack

| **Layer**      | **Technology**               | **Rationale**                                                                              |
| -------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| Frontend       | Next.js (React)              | SSR + static generation, built-in API routes, excellent OAuth support via NextAuth.js      |
| Backend API    | Next.js API Routes           | Co-located with frontend, reduces operational complexity at this scale                     |
| Database       | PostgreSQL                   | Relational model fits bracket/competition data perfectly; strong JSON support for settings |
| ORM            | Prisma                       | Type-safe schema management, migration tooling, works well with Next.js                    |
| Auth           | NextAuth.js                  | Supports Google, Apple, and Microsoft OAuth out of the box; no password management         |
| Results Import | Node.js cron job (node-cron) | Lightweight scheduled job for polling ESPN API                                             |
| Hosting (App)  | Vercel                       | Native Next.js deployment, auto-scaling, generous free tie                                 |
| Hosting (DB)   | Supabase or Railway          | Managed PostgreSQL with backups; Supabase adds a real-time layer if desire                 |
| Notifications  | In-app only (DB-backed)      | Notifications table polled client-side; no email infrastructure needed                     |

### 7.1 OAuth Configuration

Each OAuth provider requires app registration:

- Google: Google Cloud Console → OAuth 2.0 credential
- Apple: Apple Developer Portal → Sign In with Apple service ID
- Microsoft: Azure Portal → App registration with Microsoft identity platform

All three providers are configured as NextAuth.js providers with client ID and secret stored in environment variables.

## 8. Infrastructure & Hosting

### 8.1 Small Scale (Personal / Friends Group, \<500 users)

| **Resource**     | **Service**                                       | **Estimated Monthly Cost** |
| ---------------- | ------------------------------------------------- | -------------------------- |
| Frontend + API   | Vercel                                            | Hobby Free                 |
| PostgreSQL       | Supabase Free                                     | Tier Free                  |
| Results Cron Job | Vercel Cron <br/>(or Supabase Free Edge Function) |                            |
| OAuth            | Google / Apple / Microsoft                        | Free(free for basic use)   |
| **Total**        |                                                   | **~\$0/month**             |

### 8.2 Medium Scale (Hundreds to Low Thousands of Users)

| **Resource**                  | **Service**             | **Estimated Monthly Cost** |
| ----------------------------- | ----------------------- | -------------------------- |
| Frontend + API                | Vercel Pro              | \$20                       |
| PostgreSQL                    | Railway or Supabase Pro | \$10--\$25                 |
| Cron / Background Jobs Worker | Vercel Cron or Railway  | Included or \$5            |
| **Total**                     |                         | **~\$30-\$50/month**       |

### 8.3 Data Persistence Strategy

- All application state (users, rankings, brackets, competitions, results) lives in PostgreSQL
- Bracket resolution is computed and stored --- not recalculated on every read --- for performance.
- Scores are recomputed and cached in a scores summary table after each results import.
- Database backups: daily automated backups via Supabase/Railway; 7-day retention minimum.
- The ranking list and all entries are immutable after the lock time.No edits are permitted post-lock.

## 9. Application Screen Inventory

| **Screen**                      | **Description**                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Landing / Login                 | OAuth login with Google, Apple, Microsoft. <br/>Brief app description. Tournament status banner.                  |
| Dashboard                       | User's ranking lists, active competitions, <br/>notifications feed, tournament season status.                     |
| Create / Edit <br/>Ranking List | Drag-and-drop interface to order all tournament <br/>schools. Save, name, and preview both brackets.              |
| Bracket Viewer                  | Side-by-side Men's and Women's bracket visualization <br/>derived from a ranking list. Highlights actual results. |
| Competition Lobby               | Competition details, leaderboard, participant list, <br/>entry management, share/invite link.                     |
| Create Competition              | Form to configure all competition settings <br/>(scoring, reseeding, visibility, max entries).                    |
| Leaderboard                     | Ranked list of participants in a competition <br/>with scores, tiebreaker values, and bracket links.              |
| Admin Panel                     | Manage tournament season, trigger field import, <br/>monitor results import status, manage users.                 |
| Notifications                   | In-app notification center: competition invites, <br/>score updates, join alerts.                                 |
| Profile                         | User profile, linked OAuth accounts, <br/>list of all ranking lists and competitions.                             |

## 10. Open Items Before Development

The following items should be confirmed before implementation begins:

- Which external API will be the primary source for tournament field data and live results (ESPN API requires a key;
  NCAA.com has unofficial endpoints)?
- Should the application support multiple tournament seasons, or is it a fresh deployment each year?
- Is there a designated admin user, and how is admin access granted (hard-coded email, role in DB)?
- Should competitions support a Finals prediction bonus (e.g., predict the combined championship game score for a
  special tiebreaker)?
- What is the expected launch timeline relative to Selection Sunday and tournament start?

_End of Design Document_
