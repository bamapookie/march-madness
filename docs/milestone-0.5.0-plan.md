# Milestone 0.5.0 — Competitions (Group Play): Implementation Plan

## Overview

Build the full group-play feature: competition creation, membership, entry submission, invite links, a competition
lobby, and a working dashboard. No schema changes required — all models (`Competition`, `CompetitionMember`,
`CompetitionEntry`, `Invitation`) already exist.

---

## Step 1 — New shared types in `src/types/index.ts`

Add five new exported types (no Prisma imports; pure TypeScript):

```typescript
/** Lightweight competition card used in list views and the dashboard. */
type CompetitionSummary = {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  organizerId: string;
  organizerName: string | null;
  memberCount: number;
  entryCount: number;
  isLocked: boolean;
  lockAt: string; // ISO-8601
  /** Number of entries the current user has submitted. */
  userEntryCount: number;
  isOrganizer: boolean;
  settings: CompetitionSettings;
};

/** Per-member row in the lobby. */
type CompetitionMemberSummary = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
  entryCount: number;
  joinedAt: string; // ISO-8601
};

/** Per-entry row in the lobby. */
type CompetitionEntrySummary = {
  id: string;
  userId: string;
  userName: string | null;
  rankingListId: string;
  rankingListName: string;
  submittedAt: string; // ISO-8601
};

/** Full lobby payload returned by GET /api/competitions/[id]. */
type CompetitionDetail = CompetitionSummary & {
  isMember: boolean;
  members: CompetitionMemberSummary[];
  entries: CompetitionEntrySummary[];
  /** Entries belonging to the currently authenticated user. */
  userEntries: CompetitionEntrySummary[];
  /** Active invite tokens — organizer-only field; empty array for non-organizers. */
  invitations: InvitationSummary[];
};

/** Invite token summary (organizer-only). */
type InvitationSummary = {
  id: string;
  token: string;
  maxUses: number | null;
  useCount: number;
  expiresAt: string | null; // ISO-8601
  createdAt: string;
};
```

---

## Step 2 — `src/lib/competition.ts` (pure helpers)

Keep API routes thin. Extract all reusable, testable logic here:

| Function                        | Signature                                                                                              | Notes                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `getDefaultCompetitionSettings` | `() => CompetitionSettings`                                                                            | Sensible defaults for the creation form          |
| `validateCompetitionSettings`   | `(raw: unknown) => { valid: true; settings: CompetitionSettings } \| { valid: false; error: string }`  | Checks all required keys, types, ranges          |
| `getLockAtForCompetition`       | `(settings: CompetitionSettings, season: { firstFourLockAt: Date; roundOf64LockAt: Date }) => Date`    | Maps `lock_mode` to the correct season timestamp |
| `isCompetitionLocked`           | `(settings: CompetitionSettings, season: { firstFourLockAt: Date; roundOf64LockAt: Date }) => boolean` | `new Date() >= getLockAtForCompetition(...)`     |

**Default settings:**

```typescript
{
  max_lists_per_user: 1,
  lock_mode: "before_first_four",
  scoring_mode: ["correct_winner"],
  seeding_bonus_enabled: false,
  reseed_mode: "fixed",
  round_points:         { first_four: 1, round_of_64: 1, round_of_32: 2, sweet_16: 4,  elite_8: 8,  final_four: 16, championship: 32 },
  correct_winner_points:{ first_four: 2, round_of_64: 2, round_of_32: 4, sweet_16: 8,  elite_8: 16, final_four: 32, championship: 64 },
  seeding_bonus_points: { first_four: 1, round_of_64: 1, round_of_32: 2, sweet_16: 4,  elite_8: 8,  final_four: 16,
                          championship_runner_up: 24, championship_winner: 32 },
}
```

---

## Step 3 — Eight API routes

All require authentication. All return `{ data, error }`.

### `POST /api/competitions`

- **Auth:** required
- **Body:** `{ name, description?, isPublic?, settings: CompetitionSettings }`
- **Logic:**
  1. `validateCompetitionSettings(body.settings)`
  2. Find active season
  3. `db.competition.create(...)` with `organizerId = session.user.id`
  4. Auto-join organizer: `db.competitionMember.create(...)`
- **Returns:** `CompetitionSummary`

### `GET /api/competitions`

- **Auth:** required
- **Logic:** Find all competitions where user is a member (`CompetitionMember`) — includes competitions the user
  organized
- **Returns:** `CompetitionSummary[]`

### `GET /api/competitions/[id]`

- **Auth:** required; user must be a member OR competition is public
- **Logic:** Load competition + members + entries + user's entries + (if organizer) invitations
- **Returns:** `CompetitionDetail`

### `POST /api/competitions/[id]/join`

- **Auth:** required
- **Logic:**
  1. Load competition; 404 if not found
  2. Must be public (or have been invited — invite redemption is a separate route)
  3. Check `isCompetitionLocked` — locked competitions cannot be joined
  4. Idempotent: if already a member, return success
  5. `db.competitionMember.create(...)`
- **Returns:** `{ joined: true }`

### `POST /api/competitions/[id]/entries`

- **Auth:** required; user must be a member
- **Body:** `{ rankingListId: string }`
- **Validation (reject if any fail):**
  1. Competition exists and user is a member
  2. `isCompetitionLocked` → 409 if locked
  3. `rankingList.userId === session.user.id`
  4. `rankingList.lockMode` matches competition's `lock_mode` (e.g. `BEFORE_FIRST_FOUR` ↔ `"before_first_four"`)
  5. Count existing entries for `{ competitionId, userId }` < `settings.max_lists_per_user`
- **Returns:** `CompetitionEntrySummary`

### `DELETE /api/competitions/[id]/entries/[entryId]`

- **Auth:** required; entry owner only (or organizer)
- **Logic:**
  1. Load entry; 404 if not found
  2. Verify ownership: `entry.userId === session.user.id` OR `isOrganizer`
  3. `isCompetitionLocked` → 409 if locked (organizer bypass: allow regardless)
  4. `db.competitionEntry.delete(...)`
- **Returns:** `{ deleted: true }`

### `POST /api/competitions/[id]/invitations`

- **Auth:** required; organizer only
- **Body:** `{ maxUses?: number, expiresAt?: string }`
- **Logic:**
  1. Generate token: `crypto.randomBytes(16).toString('hex')`
  2. `db.invitation.create(...)`
- **Returns:** `InvitationSummary`

### `POST /api/invitations/[token]/redeem`

- **Auth:** required
- **Logic:**
  1. Find invitation by token; 404 if not found
  2. Check not expired (`expiresAt === null || expiresAt > now`)
  3. Check uses remaining (`maxUses === null || useCount < maxUses`)
  4. Idempotent: if already a member, return success (don't increment `useCount` again)
  5. `db.competitionMember.create(...)` + `db.invitation.update({ useCount: { increment: 1 } })` in a transaction
- **Returns:** `{ competitionId: string }`

---

## Step 4 — Invite redemption page

**`src/app/join/[token]/page.tsx`** — server component

- If not signed in → `redirect('/sign-in?callbackUrl=/join/' + token)`
- Call redemption logic directly (same as the API route, or call the API)
- On success → `redirect('/competition/' + competitionId)`
- On error (expired / maxed / not found) → render an error card with a clear explanation

---

## Step 5 — Competition creation UI

**`src/app/competition/create/page.tsx`** — thin server component (auth check + redirect to sign-in)

**`src/components/competition/create-competition-form.tsx`** — `"use client"` form

Three-section layout:

**Section 1 — Basic** | Field | Input | Default | |---|---|---| | `name` | text, required | `""` | | `description` |
textarea | `""` | | `isPublic` | toggle | `true` |

**Section 2 — Rules** | Field | Input | Default | |---|---|---| | `lock_mode` | radio: Before First Four / Before Round
of 64 | `before_first_four` | | `reseed_mode` | radio: Fixed / Reseed by Ranking | `fixed` | | `max_lists_per_user` |
number input 1–10 | `1` | | `scoring_mode` | checkboxes: Correct Winner / Round Advancement | `["correct_winner"]` | |
`seeding_bonus_enabled` | toggle | `false` |

**Section 3 — Points** (always visible)

Two side-by-side tables sharing a Round label column:

| Round        | Round Advancement Points | Correct Winner Points |
| ------------ | ------------------------ | --------------------- |
| First Four   | `number`                 | `number`              |
| Round of 64  | …                        | …                     |
| …            | …                        | …                     |
| Championship | `number`                 | `number`              |

When `seeding_bonus_enabled` is toggled on, a third table expands below:

| Seeding Bonus Points                          |               |
| --------------------------------------------- | ------------- |
| Round of 64 exits through Championship Winner | `number` each |

Pre-fill all inputs from `getDefaultCompetitionSettings()`.

On submit: `POST /api/competitions` → success → `router.push('/competition/' + newId)`

---

## Step 6 — Competition lobby

**`src/app/competition/[id]/page.tsx`** — server component

Loads `CompetitionDetail` from DB directly. Passes serialized data to client child components. Renders:

- **Header:** name, description, lock countdown (`"use client"` child that ticks down to `lockAt`)
- **Settings badges:** lock mode, reseed mode, scoring modes, max entries
- **Actions bar** (conditional):
  - _Non-member + public + not locked:_ "Join Competition" button
  - _Member + not locked + userEntries.length < max_lists_per_user:_ "Submit Entry" — dropdown of user's eligible
    ranking lists (filtered by lockMode match), calls `POST .../entries`
  - _Organizer:_ "Create Invite Link" — calls `POST .../invitations`, shows a copy-to-clipboard modal
- **Entries table:** all entries — user name, list name, submitted date. Own entries highlighted.
- **Members section:** member cards — avatar, name, entry count, joined date

Each mutating action (`"use client"` components) calls the API route then `router.refresh()`.

---

## Step 7 — Competition list page

**`src/app/competition/page.tsx`** — replace placeholder

Server component. Two sections:

- Header with "Create Competition" button linking to `/competition/create`
- Card grid of `CompetitionSummary[]` (user's competitions via `GET /api/competitions` or direct DB query)

**`src/components/competition/competition-card.tsx`** — new component showing name, organizer, member count, lock
status, entry count.

---

## Step 8 — Dashboard

**`src/app/dashboard/page.tsx`** — replace placeholder

Server component. Uses `Promise.all` for two parallel queries:

1. Competitions where user is a member → `CompetitionSummary[]`
2. User's ranking lists for the active season → `RankingListSummary[]`

Two-section layout:

- **My Competitions** — compact `CompetitionCard` rows with quick-link to lobby
- **My Ranking Lists** — reuse existing `RankingListCard` component

---

## Implementation Order

```
1. src/types/index.ts — add CompetitionSummary, CompetitionDetail, etc.
2. src/lib/competition.ts — pure helpers + defaults + validation
3. API routes (in dependency order):
   a. POST /api/competitions
   b. GET  /api/competitions
   c. GET  /api/competitions/[id]
   d. POST /api/competitions/[id]/join
   e. POST /api/competitions/[id]/entries
   f. DELETE /api/competitions/[id]/entries/[entryId]
   g. POST /api/competitions/[id]/invitations
   h. POST /api/invitations/[token]/redeem
4. src/app/join/[token]/page.tsx — invite redemption
5. src/components/competition/create-competition-form.tsx
6. src/app/competition/create/page.tsx
7. src/components/competition/competition-card.tsx
8. src/app/competition/page.tsx — list
9. src/app/competition/[id]/page.tsx — lobby (+ child components)
10. src/app/dashboard/page.tsx
11. Docs — CLAUDE.md, CHANGELOG.md, README.md, package.json bump to 0.5.0
```

---

## Open Questions to Resolve Before Coding

1. **Lock enforcement for join:** Should users be able to join a competition after the lock time but without submitting
   an entry? Or should joining itself be blocked at lock time? Recommendation: allow joining after lock (spectators
   welcome), but block new _entry submissions_. The current plan blocks join too — revisit if needed.

2. **Invite-only vs. public competitions:** Public competitions allow `POST /api/competitions/[id]/join` directly.
   Private (isPublic = false) competitions require an invite token. Should the lobby page be visible to non-members for
   public competitions? Recommendation: yes, show read-only lobby for public competitions to let potential joiners see
   the competition before committing.

3. **Organizer entry removal:** The `DELETE` route allows organizers to remove any entry, bypassing the lock. Confirm
   this is the desired behavior.
