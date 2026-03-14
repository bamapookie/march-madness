# Milestone 0.5.0 — Competitions (Group Play): Implementation Plan

## Overview

Build the full group-play feature: competition creation, membership, entry submission, join codes, a browsable public
lobby, a competition detail page, and a working dashboard.

**Schema changes required:** Two new fields on `Competition` — `joinCode` and `joinCutoffAt`.

---

## Competition Lifecycle

Understanding the state machine is critical before touching any code:

```
CREATED (pre-cutoff)
  │  isPublic=true  → visible in public lobby; anyone can join via code or public list
  │  isPublic=false → invisible in public lobby; must join via code/link
  │  Organizer can: change isPublic, change joinCutoffAt, remove entries
  ▼
CUTOFF PASSED (post-cutoff, pre-lock)
  │  Competition disappears from public lobby regardless of isPublic
  │  No new members can join
  │  Only members with ≥1 submitted entry (+ organizer) can view the lobby
  │  Organizer can: remove any entry
  │  Members can: remove own entries, add entries up to max_lists_per_user
  ▼
LOCKED (post-lock)
  │  No entries can be added or removed by anyone (including organizer)
  │  No organizer settings changes permitted
  │  Access: same as post-cutoff (entry-holders + organizer)
  ▼
TOURNAMENT IN PROGRESS / COMPLETE
```

**Key invariant:** `joinCutoffAt` (if set) must be ≤ the competition's effective lock time (`firstFourLockAt` or
`roundOf64LockAt` depending on `lock_mode`). Enforced at create/update time.

---

## Step 1 — Schema migration

Add two fields to `Competition` in `prisma/schema.prisma`:

```prisma
model Competition {
  // ...existing fields...

  /// Short alphanumeric code used in join links (/join/[joinCode]).
  /// Auto-generated at creation; never changes.
  joinCode     String    @unique

  /// Optional cutoff after which no new members may join.
  /// Must be ≤ the season's firstFourLockAt or roundOf64LockAt (whichever applies to lock_mode).
  /// After this time the competition is effectively private and hidden from the public lobby.
  joinCutoffAt DateTime?
}
```

Generate join code at creation with `crypto.randomBytes(4).toString('hex')` (8 hex chars, URL-safe).

Run `npx prisma migrate dev --name add_competition_join_code_and_cutoff`.

---

## Step 2 — New shared types in `src/types/index.ts`

Add five exported types:

```typescript
/** Lightweight competition card for list views, the dashboard, and the public lobby. */
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
  lockAt: string; // ISO-8601 — effective lock time for this competition
  joinCutoffAt: string | null; // ISO-8601 — null if no cutoff set
  isJoinable: boolean; // false after cutoff or lock
  joinCode: string; // used to build /join/[code] URL
  userEntryCount: number; // 0 for unauthenticated or non-member viewers
  isOrganizer: boolean;
  isMember: boolean;
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
  members: CompetitionMemberSummary[];
  entries: CompetitionEntrySummary[];
  userEntries: CompetitionEntrySummary[];
};

/** Body shape for PATCH /api/competitions/[id] (organizer updates, pre-cutoff only). */
type CompetitionUpdateInput = {
  isPublic?: boolean;
  joinCutoffAt?: string | null; // ISO-8601 or null to clear
};
```

---

## Step 3 — `src/lib/competition.ts` (pure helpers)

| Function                        | Signature                                                                                             | Notes                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `getDefaultCompetitionSettings` | `() => CompetitionSettings`                                                                           | Sensible defaults for the creation form                                                                        |
| `validateCompetitionSettings`   | `(raw: unknown) => { valid: true; settings: CompetitionSettings } \| { valid: false; error: string }` | Checks all required keys, types, ranges; `scoring_mode` must be non-empty                                      |
| `getLockAtForCompetition`       | `(settings: CompetitionSettings, season: { firstFourLockAt: Date; roundOf64LockAt: Date }) => Date`   | Maps `lock_mode` to the correct season timestamp                                                               |
| `isCompetitionLocked`           | `(settings, season) => boolean`                                                                       | `new Date() >= getLockAtForCompetition(...)`                                                                   |
| `isJoinCutoffPassed`            | `(joinCutoffAt: Date \| null) => boolean`                                                             | `joinCutoffAt !== null && new Date() >= joinCutoffAt`                                                          |
| `isJoinable`                    | `(competition, season) => boolean`                                                                    | `!isCompetitionLocked(...) && !isJoinCutoffPassed(...)`                                                        |
| `canViewCompetition`            | `(competition, userId, hasEntry) => boolean`                                                          | Pre-cutoff: organizer, members, and public if `isPublic`. Post-cutoff: only organizer or member with ≥1 entry. |
| `validateJoinCutoffAt`          | `(joinCutoffAt: Date, lockAt: Date) => boolean`                                                       | Returns true only if `joinCutoffAt <= lockAt`                                                                  |

**Default settings:**

```typescript
var competition_settings = {
  max_lists_per_user: 1,
  lock_mode: "before_first_four",
  scoring_mode: ["correct_winner"],
  seeding_bonus_enabled: false,
  reseed_mode: "fixed",
  round_points: {
    first_four: 1,
    round_of_64: 1,
    round_of_32: 2,
    sweet_16: 4,
    elite_8: 8,
    final_four: 16,
    championship: 32,
  },
  correct_winner_points: {
    first_four: 2,
    round_of_64: 2,
    round_of_32: 4,
    sweet_16: 8,
    elite_8: 16,
    final_four: 32,
    championship: 64,
  },
  seeding_bonus_points: {
    first_four: 1,
    round_of_64: 1,
    round_of_32: 2,
    sweet_16: 4,
    elite_8: 8,
    final_four: 16,
    championship_runner_up: 24,
    championship_winner: 32,
  },
};
```

---

## Step 4 — API routes

All return `{ data, error }`. All mutating routes require authentication.

### `POST /api/competitions`

- **Auth:** required
- **Body:** `{ name, description?, isPublic?, joinCutoffAt?, settings: CompetitionSettings }`
- **Logic:**
  1. `validateCompetitionSettings(body.settings)`
  2. Find active season; compute `lockAt = getLockAtForCompetition(...)`
  3. If `joinCutoffAt` provided: `validateJoinCutoffAt(joinCutoffAt, lockAt)` → 400 if invalid
  4. Generate `joinCode = crypto.randomBytes(4).toString('hex')`
  5. `db.competition.create(...)` with `organizerId = session.user.id`
  6. Auto-join organizer: `db.competitionMember.create(...)`
- **Returns:** `CompetitionSummary`

### `PATCH /api/competitions/[id]`

- **Auth:** required; organizer only
- **Body:** `CompetitionUpdateInput`
- **Logic:**
  1. Load competition; 404 if not found; 403 if not organizer
  2. Reject 409 if `isCompetitionLocked` — no changes after lock
  3. Reject 409 if `isJoinCutoffPassed` — no settings changes after cutoff
  4. If `joinCutoffAt` is being set: validate ≤ lock time
  5. `db.competition.update(...)`
- **Returns:** `CompetitionSummary`

### `POST /api/competitions/[id]/rotate-code`

- **Auth:** required; organizer only
- **Logic:**
  1. Load competition; 404 if not found; 403 if not organizer
  2. Reject 409 if `isJoinCutoffPassed` — code rotation only allowed before cutoff
  3. Generate `newCode = crypto.randomBytes(4).toString('hex')`
  4. `db.competition.update({ joinCode: newCode })`
  5. The old code is immediately invalidated — any `/join/[oldCode]` links will return 404
  6. Existing members are unaffected; they retain membership and may continue submitting entries (up to
     `max_lists_per_user`) without the new code
- **Returns:** `{ joinCode: string }` (the new code)

### `GET /api/competitions`

- **Auth:** required
- **Logic:** All competitions where user is a member; compute `isJoinable`, `isLocked` for each
- **Returns:** `CompetitionSummary[]`

### `GET /api/competitions/public`

- **Auth:** optional
- **Logic:** `isPublic = true` AND (`joinCutoffAt IS NULL OR joinCutoffAt > now`)
- **Returns:** `CompetitionSummary[]` (`userEntryCount: 0`, `isOrganizer: false` for unauthenticated)

### `GET /api/competitions/[id]`

- **Auth:** required
- **Access control (enforced server-side):**
  - Pre-cutoff: member OR (`isPublic` → anyone) can view
  - Post-cutoff: only organizer OR member with ≥1 submitted entry → else 403
- **Returns:** `CompetitionDetail`

### `POST /api/competitions/join`

- **Auth:** required
- **Body:** `{ code: string }`
- **Logic:**
  1. Find competition by `joinCode`; 404 if not found
  2. `isJoinable(competition, season)` → 409 if not joinable (cutoff passed or locked)
  3. Idempotent: already a member → return success without error
  4. `db.competitionMember.create(...)`
- **Returns:** `{ competitionId: string, alreadyMember: boolean }`

### `POST /api/competitions/[id]/entries`

- **Auth:** required; user must be a member
- **Body:** `{ rankingListId: string }`
- **Validation:**
  1. Competition exists and user is a member
  2. `!isCompetitionLocked` → else 409
  3. `rankingList.userId === session.user.id`
  4. `rankingList.lockMode` matches competition's `lock_mode`
  5. Existing entry count for `{ competitionId, userId }` < `settings.max_lists_per_user`
- **Returns:** `CompetitionEntrySummary`

### `DELETE /api/competitions/[id]/entries/[entryId]`

- **Auth:** required
- **Logic:**
  1. Load entry; 404 if not found
  2. **Regular member:** must own the entry AND `!isCompetitionLocked` → else 403/409
  3. **Organizer:** may remove any entry, but only if `!isCompetitionLocked`
  4. `db.competitionEntry.delete(...)`
- **Returns:** `{ deleted: true }`

> The `Invitation` model remains in the schema for future use; no invitation routes are implemented in 0.5.0. The join
> code is the primary and only access mechanism this milestone.

---

## Step 5 — Join page

**`src/app/join/[code]/page.tsx`** — server component

- Not signed in → `redirect('/sign-in?callbackUrl=/join/' + code)`
- Competition not found → "Invalid join code" error card
- Already a member → `redirect('/competition/' + id)`
- `!isJoinable` → "This competition is no longer accepting new members" card
- Otherwise: join via `POST /api/competitions/join` then `redirect('/competition/' + id)`

---

## Step 6 — Competition creation UI

**`src/app/competition/create/page.tsx`** — thin server component (auth check + redirect)

**`src/components/competition/create-competition-form.tsx`** — `"use client"`

**Section 1 — Basic** | Field | Input | Default | Notes | |---|---|---|---| | `name` | text, required | `""` | | |
`description` | textarea | `""` | | | `isPublic` | toggle | `true` | Public = appears in lobby before cutoff | |
`joinCutoffAt` | datetime-local, optional | `""` | Must be before lock time; "After this time new members cannot join
and the competition becomes private" |

**Section 2 — Rules** | Field | Input | Default | |---|---|---| | `lock_mode` | radio | `before_first_four` | |
`reseed_mode` | radio | `fixed` | | `max_lists_per_user` | number 1–10 | `1` | | `scoring_mode` | checkboxes |
`["correct_winner"]` | | `seeding_bonus_enabled` | toggle | `false` |

**Section 3 — Points** — two side-by-side tables (Round Advancement | Correct Winner) pre-filled from defaults;
collapsible Seeding Bonus table appears when `seeding_bonus_enabled` is on.

On submit: `POST /api/competitions` → `router.push('/competition/' + id)`

---

## Step 7 — Competition lobby

**`src/app/competition/[id]/page.tsx`** — server component

1. Check auth; redirect to sign-in if not signed in
2. Load `CompetitionDetail` from DB
3. `canViewCompetition(...)` → redirect to `/competition` with toast error if denied
4. Pass serialized data to `"use client"` child components

**Lobby layout:**

- **Header:** name, description, join code chip (copy button), lock countdown
- **Status banner:**
  - Pre-cutoff + public: "Open — Anyone with the code can join"
  - Pre-cutoff + private: "Private — Share the code to invite members"
  - Post-cutoff + pre-lock: "Closed to new members — Entries lock [lockAt]"
  - Locked: "Locked — Tournament in progress"
- **Organizer settings** (`"use client"` child, organizer-only, pre-cutoff only):
  - Toggle `isPublic`, edit `joinCutoffAt` → `PATCH /api/competitions/[id]` + `router.refresh()`
  - "Rotate Join Code" button → `POST /api/competitions/[id]/rotate-code`; displays new code immediately and updates the
    copy chip; old code silently stops working
- **Actions bar:**
  - Non-member + `isJoinable` → "Join" (calls `POST /api/competitions/join`)
  - Member + not locked + `userEntries.length < max_lists_per_user` → "Submit Entry" dropdown
  - Neither shown when locked
- **Entries table:** all entries; organizer sees delete button on each row (pre-lock only)
- **Members section:** avatars, names, entry count, joined date

---

## Step 8 — Competition list & public lobby

**`src/app/competition/page.tsx`** — server component

Two sections:

1. **Browse public competitions** — from `GET /api/competitions/public`; shown to all visitors
2. **My competitions** — from `GET /api/competitions`; signed-in users only

**`src/components/competition/competition-card.tsx`** — shows name, organizer, member/entry counts, status badge (Open /
Closed / Locked), cutoff/lock countdown.

---

## Step 9 — Dashboard

**`src/app/dashboard/page.tsx`** — replace placeholder; requires auth

`Promise.all` for two parallel queries:

1. Competitions where user is a member → `CompetitionSummary[]`
2. User's ranking lists for active season → `RankingListSummary[]`

Two-section layout: **My Competitions** + **My Ranking Lists** (reuse `RankingListCard`).

---

## Implementation Order

```
1.  prisma/schema.prisma     — add joinCode, joinCutoffAt; run migration
2.  src/types/index.ts       — CompetitionSummary, CompetitionDetail, etc.
3.  src/lib/competition.ts   — pure helpers + defaults + validation
4.  API routes:
      a. POST   /api/competitions
      b. PATCH  /api/competitions/[id]
      c. POST   /api/competitions/[id]/rotate-code
      d. GET    /api/competitions
      e. GET    /api/competitions/public
      f. GET    /api/competitions/[id]
      g. POST   /api/competitions/join
      h. POST   /api/competitions/[id]/entries
      i. DELETE /api/competitions/[id]/entries/[entryId]
5.  src/app/join/[code]/page.tsx
6.  src/components/competition/create-competition-form.tsx
7.  src/app/competition/create/page.tsx
8.  src/components/competition/competition-card.tsx
9.  src/app/competition/page.tsx
10. src/app/competition/[id]/page.tsx  (+ child client components)
11. src/app/dashboard/page.tsx
12. Docs — CLAUDE.md, CHANGELOG.md, README.md, package.json → 0.5.0
```

---

## Resolved Open Questions

1. **Lock enforcement for join:** Joining is blocked at `joinCutoffAt` (independent of lock time). If no cutoff is set,
   joining is blocked only at lock time.

2. **Public lobby visibility:** Public competitions appear in the public lobby until cutoff. After cutoff, they are
   hidden from the public list and access is restricted to organizer + entry-holders.

3. **Organizer entry removal:** Organizers can remove any entry before lock. After lock, nobody (including the
   organizer) can remove entries.

4. **Visibility changes:** Organizer can toggle `isPublic` and update `joinCutoffAt` before cutoff. After cutoff, no
   settings changes are permitted.

5. **Post-cutoff access:** Only the organizer and members who have submitted ≥1 entry can view the competition page
   after cutoff.
