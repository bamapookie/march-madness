March Madness Bracket App
=========================

Application Design Document

Version 1.0 • March 2026

## 1. Application Concept

This application allows users to build personalized ranking lists of all schools participating in the NCAA Men's and Women's Basketball Tournaments. Each ranking list a user creates serves as their bracket prediction for both tournaments simultaneously --- the higher-ranked school always advances when two schools meet.

### 1.1 Core Mechanic

- All schools fielding a team in either the Men's or Women's NCAA Tournament are pooled into a single combined field
- A school with both a Men's and Women's team occupies one slot in the ranking, and that ranking applies to both brackets
- The user orders this full field from best (#1) to worst, creating their personal ranking list
- That ranking list is automatically resolved into both a Men's and Women's bracket using standard NCAA bracket structure (four regions) including the First Four play-in games
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
|------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| **Visibility**         | Public (join via link) or <br/>Private (invite-only) | Controls who can discover and <br/>join the competition         |
| **Max lists per user** | 1 or more <br/>(organizer sets limit)                | How many ranking lists <br/>a single user may enter             |
| **Join deadline**      | Locks at tournament start                            | All competitions lock at tournament <br/>start; no late entries |

### 3.2 Scoring Options

Organizers define scoring independently for each competition. Two scoring modes are available and may be combined:

#### Mode A: Round Advancement Points

Points awarded for correctly predicting that a school reaches a given round, regardless of path.

- Organizer sets a point value for each round (First Four throughChampionship).
- A school reaching a round earns points for any participant whose ranking had that school reaching at least that round.

#### Mode B: Correct Game Winner Points

Points awarded for correctly predicting the winner of a specific game.

- Organizer sets a point value per correct game winner per round.
- Points scale by round as configured.

#### Bonus: Seeding Accuracy Points

- Optional bonus points for correctly predicting a school advances to the exact round they were seeded to reach based on
  the user's original ranking.
- Organizer enables/disables this and sets the bonus value.

### 3.3 Reseeding Options

When an upset occurs (a lower-ranked school defeats a higher-ranked school), subsequent rounds can be handled in one of two ways:

| **Mode**                                        | **Behavior**                                                                                                                                              |
|-------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Slot-based (no reseed)**                      | The upset winner inherits the eliminated team's bracket slot. The user's ranking still determines all subsequent matchups in that slot.                   |
| **Reseed by original**                          | After each round, surviving teams are redistributed ranking into a fresh bracket seeded by each user's original ranking order, ignoring how they arrived. |
| **Organizer selects one mode per competition.** | This applies to both the Men's and Women's brackets equally.                                                                                              |

### 3.4 Tiebreaking

When two participants have identical total scores, the tiebreaker is resolved as follows:

- Primary tiebreaker: The participant whose Men's and Women's bracket scores are closer together (smaller absolute difference) wins. This rewards balanced knowledge across both tournaments.
- If the difference is also equal, participants share the rank.

## 4. Data Model

### 4.1 Entity Overview

| **Entity**          | **Key Fields**                                                           | **Notes**                                               |
|---------------------|--------------------------------------------------------------------------|---------------------------------------------------------|
| users               | id, name, email, avatar_url, oauth_provider,  oauth_id                   | One record per person regardless of OAuth provider used |
| tournament_seasons  | id, year, mens_start_at,  womens_start_at, lock_a                        | Defines the active season  window; locks all brackets   |
| schools             | id, name, conference, has_mens_team, has_womens_team                     | Populated from tournament  field each year              |
| bracket_slots       | id, season_id, gender, region, round, slot_number, school_id             | Official NCAA bracket  placement; First Four included   |
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
  "max_lists_per_use": 1,
  "scoring_mode": [
    "round_advancemen",
    "correct_winner"
  ],
  "seeding_bonus_enable": true,
  "seeding_bonus_points": 5,
  "reseed_mod": "slot_based",
  "round_points": {
    "first_four": 1,
    "round_of_64": 2,
    "round_of_32": 3,
    "sweet_16": 5,
    "elite_8": 8,
    "final_four": 13,
    "championship": 21
  },
  "correct_winner_points": {
    "first_four": 1,
    "round_of_64": 1,
    "round_of_32": 2,
    "sweet_16": 4,
    "elite_": 8,
    "final_four": 16,
    "championship": 32
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
- Step 4: If reseeding is enabled for a competition, after each round's actual results are known, surviving schools are
  redistributed into fresh bracket slots ordered by their original rank position in the user's list before resolving the
  next round.

### 5.2 Scoring a Bracket

After actual tournament results are imported:

- For round advancement scoring: compare each school's predicted final round (from the resolved bracket) against the
  actual round they reached. Award points for each round where prediction ≥ actual, up to the actual round reached.
- For correct winner scoring: compare each predicted game winner against the actual game winner. Award points forcorrect
  predictions per round.
- For seeding bonus: award bonus points where a school reached the exact round the user's ranking predicted.
- Combined score = Men's bracket score + Women's bracket score.
- Tiebreaker value = `|Men's score − Women's score|` (smaller is better).

## 6. External Data Integration

### 6.1 Tournament Field Import

Prior to the tournament, an admin triggers an import to populate the schools and bracket_slots tables for the new season. Potential sources:

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
|----------------|------------------------------|--------------------------------------------------------------------------------------------|
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
|------------------|---------------------------------------------------|----------------------------|
| Frontend + API   | Vercel                                            | Hobby Free                 |
| PostgreSQL       | Supabase Free                                     | Tier Free                  |
| Results Cron Job | Vercel Cron <br/>(or Supabase Free Edge Function) |                            |
| OAuth            | Google / Apple / Microsoft                        | Free(free for basic use)   |
| **Total**        |                                                   | **~\$0/month**             |

### 8.2 Medium Scale (Hundreds to Low Thousands of Users)

| **Resource**                  | **Service**             | **Estimated Monthly Cost** |
|-------------------------------|-------------------------|----------------------------|
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
|---------------------------------|-------------------------------------------------------------------------------------------------------------------|
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

- Which external API will be the primary source for tournament field data and live results (ESPN API requires a key; NCAA.com has unofficial endpoints)?
- Should the application support multiple tournament seasons, or is it a fresh deployment each year?
- Is there a designated admin user, and how is admin access granted (hard-coded email, role in DB)?
- Should competitions support a Finals prediction bonus (e.g., predict the combined championship game score for a special tiebreaker)?
- What is the expected launch timeline relative to Selection Sunday and tournament start?

*End of Design Document*
