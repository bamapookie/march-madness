# Reseeding scenarios

After studying the scoring mechanisms, it appears that we need to rethink the Round advancement bonus. In the case where
reseeding is disabled, the logic for the Round advancement bonus is the same as for Correct Winner Points. So we may
want to remove Round Advancement Bonus when reseeding is disabled. Also, when reseeding is enabled, there are a number
of different cases that we need to figure out how they would be handled when reseeding. Let's look at one game in a
later round and determine all the scenarios that could occur with reseeding:

- Both teams from the original seeding are still playing. The predicted winner does win. User gets Correct Winner points
  and the Round Advancement Bonus for the winner and Seeding Accuracy Bonus for the loser.
- Both teams from the original seeding are still playing. The predicted winner loses. User gets no points.
- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a lower rank than the originally predicted winner. The predicted winner does win. User gets Correct
  Winner points and the Round Advancement Bonus points.
- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a lower rank than the originally predicted winner. The predicted winner loses. User gets no points.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a higher rank than the originally predicted loser. The predicted winner does win. User gets Correct
  Winner points for the winner and the Seeding Accuracy Bonus for the loser.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a higher rank than the originally predicted loser. The predicted winner loses. User gets no points.
- Neither originally predicted team is still playing. The new team with the higher rank wins. User gets Correct Winner
  points.
- Neither originally predicted team is still playing. The new team with the lower rank wins. User gets no points.

- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a higher rank than the originally predicted winner. Does the pick flip to the higher ranked team? If Yes:
  (User gets points in either case) The newly predicted winner does win. User gets Correct Winner points.
- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a higher rank than the originally predicted winner. Does the pick flip to the higher ranked team? If Yes:
  (User gets points in either case) The newly predicted winner loses. User gets Round Advancement Bonus points.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a lower rank than the originally predicted loser. Does the pick flip to the higher ranked team? If Yes:
  (User gets points in either case) The newly predicted winner does win. User gets Correct Winner points.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a lower rank than the originally predicted loser. Does the pick flip to the higher ranked team? If Yes:
  (User gets points in either case) The newly predicted winner loses. User gets Seeding Accuracy Bonus points.
-
- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a higher rank than the originally predicted winner. Does the pick flip to the higher ranked team? If No:
  The originally predicted winner does win. User gets Correct Winner points and the Round Advancement Bonus points.
- The originally predicted winner is still playing, but the originally seeded loser has been eliminated. The reseeded
  opponent has a higher rank than the originally predicted winner. Does the pick flip to the higher ranked team? If No:
  The originally predicted winner loses. User gets no points.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a lower rank than the originally predicted loser. Does the pick flip to the higher ranked team? If No:
  The originally predicted loser does win. User gets no points.
- The originally predicted winner has been eliminated, but the originally predicted loser is still playing. The reseeded
  opponent has a lower rank than the originally predicted loser. Does the pick flip to the higher ranked team? If No:
  The originally predicted loser loses. Seeding accuracy bonus

# What APIs are available from ESPN to pull the results I need?

The `src/lib/import.ts` file hasn't been created yet. Based on your project's needs (NCAA Men's and Women's tournament
results), here's a rundown of the relevant **unofficial ESPN APIs** — ESPN doesn't publish an official public API, but
their internal endpoints are widely used and well-documented by the community:

---

## ESPN Hidden/Internal APIs

### 1. Scoreboard (Live & Final Game Results)

```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/scoreboard
```

**Query params:**

- `dates=20260315` — filter by date (YYYYMMDD)
- `groups=50` — NCAA Tournament group ID for Men's
- `groups=49` — NCAA Tournament group ID for Women's
- `limit=100` — number of events per page

Returns game status, scores, team IDs, and winner for each game.

---

### 2. Tournament Bracket

```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/{tournamentId}
```

This returns the full bracket structure — regions, seeds, slots, and results round by round. This is your **most
valuable endpoint** for mapping games to bracket positions (which directly maps to your `bracket_slots` table).

---

### 3. Team/School Reference Data

```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500
GET https://site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball/teams?limit=500
```

Useful for the initial population of your `schools` table — gives ESPN team IDs, names, and abbreviations.

---

### 4. Specific Game Summary

```
GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event={eventId}
```

Returns full box score + play-by-play for a specific game. Probably overkill for your use case but useful for debugging.

---

## What You Actually Need For This App

Given your data model (`tournament_results`, `bracket_slots`), you need two things from ESPN:

| Need                                                            | Endpoint                                 |
| --------------------------------------------------------------- | ---------------------------------------- |
| **Which teams are in which bracket slot** (at tournament start) | Tournaments bracket endpoint             |
| **Which team won each game, after it's played**                 | Scoreboard endpoint (polled every 5 min) |

---

## Key Considerations

1. **No API key required** — these are unauthenticated public endpoints, but ESPN can rate-limit or block them. Use
   reasonable polling intervals (your design doc says every 5 min during games, hourly otherwise — that's fine).

2. **Tournament IDs change each year** — you'll need to discover the `tournamentId` at the start of each season. You can
   find it by fetching the scoreboard during tournament week and inspecting the `groups` or `leagues` field in the
   response.

3. **Men's group ID = 100** (not 50 as sometimes cited) for the NCAA Tournament specifically — worth verifying via a
   live request as these have shifted over the years.

4. **No official SLA** — ESPN has broken/changed these endpoints before. Your design doc's note about logging failures
   and surfacing stale data warnings to admins is exactly the right mitigation.

5. **CORS** — these endpoints block browser requests; your polling must run **server-side** (your `node-cron` job in
   `src/lib/import.ts` is the right place).

---

## Recommended Approach

For `src/lib/import.ts`, the flow should be:

1. Hit the **tournaments bracket endpoint** on season setup → populate `bracket_slots` and `schools`
2. Poll the **scoreboard endpoint** on your cron schedule → detect completed games → write to `tournament_results`
3. After each write, trigger bracket score recomputation and leaderboard cache update

The open question in your `CLAUDE.md` — _"Which ESPN API endpoint / key will be used?"_ — is answered: **no key
needed**, just the endpoints above.

# Is there anything else we need to consider before generating code?

Good timing to do this review. Looking at the `package.json` and cross-referencing the full design, here are the gaps
that should be resolved **before** generating code:

---

## 🔴 Critical Issues

### 1. Vercel + `node-cron` are incompatible

Vercel is **serverless** — there's no persistent process for `node-cron` to run in. Options:

- **Vercel Cron Jobs** (recommended) — define cron schedules in `vercel.json`, which call an API route. Free tier allows
  daily; paid tiers allow up to every minute
- **External worker** — a separate Railway or Render service running the cron

This affects the architecture of `src/lib/import.ts` significantly. **Decision needed.**

### 2. No dependencies installed yet

`package.json` only has Next.js and React. Before any code runs, you'll need to add:

```
prisma, @prisma/client
next-auth (v5 / Auth.js), @auth/prisma-adapter
node-cron + @types/node-cron (if not using Vercel Cron)
@types/node (already in devDeps ✅)
```

### 3. NextAuth version — v4 vs v5 (Auth.js)

The API surface is completely different between the two. Given your Next.js 16 + React 19 stack, **Auth.js v5** is the
right choice — but need to confirm, as the import paths (`next-auth/providers/google` vs `@auth/core/providers/google`)
and config shape differ.

---

## 🟡 Design Gaps That Need Decisions

### 4. Selection Sunday is this Sunday (March 15, 2026)

The bracket field won't be announced until Sunday. This means:

- ESPN **tournament IDs** for 2026 aren't available yet
- `bracket_slots` data can't be seeded until after Selection Sunday
- You'll need a **manual admin trigger** (or the cron job) to do the initial bracket import — confirm this flow

### 5. School ranking list size — up to 136 teams

Men's = 68 teams, Women's = 68 teams. A school **could** appear in both tournaments. Your design says they get **one
slot** in the ranking. This raises:

- How is the initial ranking list pre-populated for the user? Do they start from a blank list or a suggested order?
- How does the UI handle 136 items in a drag-to-rank interface?

### 6. Seeding accuracy bonus is underspecified

> "Bonus points when a school reaches the exact round the user's ranking predicted"

How is "the round the ranking predicted" determined? Two interpretations:

- **Interpretation A:** Based on the school's position in the user's ranking (e.g., if ranked #1–4 → predicted to reach
  championship)
- **Interpretation B:** Based on where the bracket resolution _placed_ that school (i.e., the round they were predicted
  to exit in the resolved bracket)

These produce very different scoring logic. **Decision needed.**

### 7. `reseed_by_ranking` mode needs a clearer spec

The CLAUDE.md says: _"redistribute surviving schools by original rank before resolving the next predicted round."_ But
the predicted bracket was already resolved once at lock time — do you:

- **Re-resolve the entire predicted bracket from scratch** each round using only surviving schools?
- Or **only adjust the remaining rounds** of the already-resolved bracket?

### 8. First Four lock timing

The First Four games start **before** the Round of 64. Does `lock_at` happen:

- Before **First Four** (so users are locked in before any games are played)?
- Before **Round of 64** (so users can see First Four results before locking)?

This affects enforcement logic in the API layer.

---

## 🟢 Minor Things Worth Confirming

| Item                        | Question                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Database host**           | Supabase or Railway? Affects connection string format and pooling config                                                         |
| **Prisma schema**           | Not written yet — needs full field definitions, indexes, and constraints before any code                                         |
| **`/types` directory**      | Empty — shared TypeScript types need to be defined first to avoid circular dependencies                                          |
| **`import:results` script** | Needs to be added to `package.json` scripts                                                                                      |
| **`typecheck` script**      | Missing from `package.json` — add `"typecheck": "tsc --noEmit"`                                                                  |
| **ESPN group IDs**          | `groups=50` (Men's) and `groups=49` (Women's) in CLAUDE.md — worth a quick live test to confirm these are still correct for 2026 |
| **Max competition entries** | Is there a system-wide limit on number of competitions, or just `max_lists_per_user` per competition?                            |

---

## Recommended Order of Operations

Once decisions are made, the safest generation order is:

1. **`prisma/schema.prisma`** — everything else depends on it
2. **`/types`** — shared TypeScript types derived from the schema
3. **`src/lib/db.ts`** — Prisma client singleton
4. **`src/lib/auth.ts`** — NextAuth config
5. **`src/lib/bracket.ts`** — pure bracket resolution logic (no DB)
6. **`src/lib/scoring.ts`** — pure scoring logic (no DB)
7. **`src/lib/import.ts`** — ESPN API integration
8. **API routes** — once lib layer is solid
9. **UI components** — last, once the data layer is proven

The three decisions that will block everything else: **Vercel Cron vs node-cron**, **Auth.js v4 vs v5**, and **seeding
accuracy bonus interpretation**.

# Use Vercel Cron and Auth.js v5

Good decisions. Here's what those choices lock in architecturally, and what's still open:

---

## ✅ What These Decisions Settle

### Vercel Cron

- Cron schedules live in **`vercel.json`**, not in application code
- Each schedule calls a **protected API route** (e.g., `GET /api/cron/import-results`)
- The route must be protected with a `CRON_SECRET` env var — Vercel injects an `Authorization` header on each call; the
  route validates it
- `src/lib/import.ts` becomes a **plain async function** (no scheduler logic at all), called by the API route
- The `npm run import:results` dev script should call the same function directly for local testing
- **Execution time limit:** 60s on Hobby plan, 300s on Pro — the import function must complete within this

### Auth.js v5

- Package is **`next-auth@5`** (beta/stable v5), adapter is **`@auth/prisma-adapter`**
- Config lives in **`src/lib/auth.ts`** and exports `{ auth, signIn, signOut, handlers }`
- Route handler is a single file at **`src/app/api/auth/[...nextauth]/route.ts`** that re-exports `handlers`
- Server components use `const session = await auth()` — no more `getServerSession()`
- Middleware uses `export { auth as middleware } from "@/lib/auth"` in `src/middleware.ts`
- Requires **`AUTH_SECRET`** env var (replaces `NEXTAUTH_SECRET`)

---

## ❓ Still Open (Blocking Code Generation)

These three still need answers before the scoring and bracket logic can be written:

### 1. Seeding accuracy bonus interpretation

Which definition?

- **A — Ranking-position-based:** A school's "predicted round" is determined by their rank position (e.g., rank 1–4 →
  predicted champion, 5–8 → predicted finalist, etc. based on how many teams are in the bracket)
- **B — Bracket-resolution-based:** After the bracket is resolved at lock time, the round where the school is predicted
  to be _eliminated_ is stored — that's their target round

### 2. `reseed_by_ranking` mode

After a round's real results come in, do you:

- **A — Full re-resolution:** Take all surviving teams, re-sort by original rank, and re-fill the remaining bracket
  slots fresh (winners/losers change for future rounds)
- **B — Partial adjustment:** Keep the already-resolved predicted bracket, but swap out eliminated teams' future slots
  with the actual survivor

### 3. First Four lock timing

- **Before First Four** — users must submit before any games are played
- **Before Round of 64** — users can wait to see First Four results, then lock in

---

## ❓ Still Open (Non-Blocking But Should Confirm Soon)

| Question                                                           | Why it matters                                                                            |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Database host** — Supabase or Railway?                           | Connection string format + whether you need Prisma connection pooling (`?pgbouncer=true`) |
| **Ranking list pre-population** — blank or seeded from NCAA seeds? | Determines if you need a "suggested order" import step                                    |
| **System-wide competition limit?**                                 | Schema constraint decision                                                                |

Once you answer the three blocking ones, code generation can start from the top of the stack.
