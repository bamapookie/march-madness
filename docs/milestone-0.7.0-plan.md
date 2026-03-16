# Milestone 0.7.0 Plan — Notifications & Polish

Ship the final pre-launch milestone: in-app notification bell with client-side polling, a mobile-responsive layout pass
across all screens, Next.js loading skeletons and error boundaries on every route, polished empty states, and admin
panel hardening with DB health status.

---

## Step 1 — Notifications API

Create `src/app/api/notifications/route.ts`:

- `GET` — returns the current user's unread notifications (newest-first, limit 20). Response:
  `{ data: NotificationSummary[], error }`.
- `PATCH` — marks all of the current user's notifications as read. Response: `{ data: { count: number }, error }`.

Create `src/app/api/notifications/[id]/route.ts`:

- `PATCH` — marks a single notification as read.
- `DELETE` — deletes a single notification (user must own it).

Create `src/lib/notifications.ts`:

- Export `createNotification(userId: string, title: string, body: string, link?: string): Promise<void>` — thin wrapper
  around `db.notification.create`.
- Wire into existing flows:
  - **Score computation** (`src/lib/scoring.ts` → `recomputeAllScores`): after scores are written, call
    `createNotification` for every user whose entry received new points, e.g. _"Scores updated — check your leaderboard
    position."_ Deduplicate per score-computation run per user, not per game, to avoid spamming during rapid cron
    imports.
  - **Join confirmation** (`src/app/api/competitions/[id]/join/route.ts`): notify the joining user, e.g. _"You joined
    [Competition Name]."_

Add `NotificationSummary` type to `src/types/index.ts`:

```typescript
export type NotificationSummary = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  link: string | null;
  createdAt: string; // ISO-8601
};
```

---

## Step 2 — Notification Bell Component

Create `src/components/nav-notifications.tsx` (`"use client"`):

- On mount and every 30 s, call `GET /api/notifications`. Back off to 60 s when `document.visibilityState` is hidden.
- Show a bell icon (Lucide `Bell`) in the nav with an unread badge count (hidden when 0).
- Clicking the bell toggles a dropdown list of the 20 most-recent notifications, each showing title, body, relative
  time, and a deep-link if present.
- "Mark all read" button at the top of the dropdown calls `PATCH /api/notifications` then re-fetches.
- Clicking an individual notification calls `PATCH /api/notifications/[id]` (mark read) and follows `link` if present.
- If no notifications exist, show an empty state: _"You're all caught up."_

Refactor `src/components/nav.tsx`:

- Keep the outer `<header>` as a server component.
- Import and render `<NotificationBell />` as a client island between the nav links and the sign-out button. The bell
  fetches its own data client-side, so no session prop is needed.

---

## Step 3 — Mobile-Responsive Layout Pass

**`src/components/nav.tsx`** — add a hamburger menu for `sm` and below:

- Render a `☰` / `✕` toggle button on small screens.
- Drop-down panel containing the same links (Dashboard, My Rankings, Competitions) and the sign-out button.
- Notification bell always visible in the top bar regardless of screen size.
- Implemented with a `"use client"` `<MobileNavDrawer>` island; the outer nav shell stays a server component.
- Use CSS `translate` and a `useEffect` scroll lock on `document.body`; no third-party dependency.

**`src/components/ranking/ranking-editor.tsx`**:

- Increase drag handle tap target to at least 44 × 44 px on touch devices (add `touch-action: none` via Tailwind class
  and enlarge the grip icon hit area).
- Filter/search bar stacks vertically on narrow screens (switch from `flex-row` to `flex-col sm:flex-row`).
- Save/name controls stack on `xs` screens.

**`src/components/bracket/bracket-viewer.tsx`**:

- Wrap each region column in `overflow-x-auto` so it scrolls horizontally on small screens rather than overflowing the
  viewport.
- Add a sticky round-label header per region so users can orient themselves while scrolling.
- Tab switcher between Men's / Women's should be full-width pill tabs on mobile.

**Leaderboard page** (`src/app/competition/[id]/leaderboard/page.tsx`):

- Wrap the table in `overflow-x-auto`.
- On `sm` and below, hide the tiebreaker column and the per-gender breakdown columns; show only rank, name, and total
  score. Add a row-level expand/collapse to reveal the full breakdown.

**Competition lobby** (`src/app/competition/[id]/page.tsx` + `lobby-client.tsx`):

- Members and entries tables: `overflow-x-auto` wrapper; hide less-critical columns below `md`.
- Action buttons (Submit, Remove) shrink to icon-only on small screens with a tooltip.

**Dashboard** (`src/app/dashboard/page.tsx`):

- Card grid switches from `grid-cols-2` to `grid-cols-1` below `sm`.

---

## Step 4 — Loading Skeletons

Add `loading.tsx` (Next.js Suspense boundary files) to each of the following route segments. Each file exports a default
component that renders a Tailwind CSS pulse skeleton that roughly matches the page's layout:

| Route segment                                 | Skeleton shape                          |
| --------------------------------------------- | --------------------------------------- |
| `src/app/dashboard/`                          | Two section headers + 2–3 card outlines |
| `src/app/ranking/`                            | Header + 3 list-card outlines           |
| `src/app/ranking/[id]/`                       | Header + 10 school-row outlines         |
| `src/app/competition/`                        | Header + 3 card outlines                |
| `src/app/competition/[id]/`                   | Lobby header + member table skeleton    |
| `src/app/competition/[id]/leaderboard/`       | Table with 5 row skeletons              |
| `src/app/competition/[id]/entries/[entryId]/` | Score summary + bracket skeleton        |
| `src/app/bracket/[id]/`                       | Two-column bracket skeleton             |
| `src/app/admin/`                              | Stats grid + import section skeleton    |

Create a shared `src/components/ui/skeleton.tsx` helper:

```tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-800 ${className ?? ""}`} />;
}
```

---

## Step 5 — Error Boundaries

Add `error.tsx` (`"use client"`) to the same route segments as the loading skeletons. Each file should:

- Accept `{ error, reset }` props (Next.js App Router error boundary contract).
- Display a user-friendly heading (_"Something went wrong"_), the `error.message` in a collapsed `<details>` block (dev
  only, guarded by `process.env.NODE_ENV === "development"`), a **"Try again"** button that calls `reset()`, and a **"←
  Go back"** link using `useRouter().back()`.
- Reuse a shared `src/components/ui/error-boundary-content.tsx` component so each route's `error.tsx` is a thin wrapper.

---

## Step 6 — Empty States Audit

Review every list/table surface and ensure a polished empty state exists:

| Surface                           | Trigger                      | Empty state message                                                                                                 |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Dashboard — My Ranking Lists      | No lists yet                 | _"You haven't created a ranking list yet."_ + Create button                                                         |
| Dashboard — My Competitions       | Not a member of any          | _"You haven't joined any competitions yet."_ + Browse link                                                          |
| Ranking list page (`/ranking`)    | No lists                     | Already exists — verify styling                                                                                     |
| Competition lobby — members table | No members besides organizer | _"No other members have joined yet."_                                                                               |
| Competition lobby — entries table | No entries submitted         | _"No entries have been submitted yet."_                                                                             |
| Leaderboard                       | No scores computed           | _"Scores will appear here once tournament games begin."_ (already guarded by redirect — add inline message instead) |
| Notifications dropdown            | No notifications             | _"You're all caught up."_                                                                                           |
| Admin — no active season          | No season in DB              | _"No active season found. Run `npm run seed:test` to create one."_ (already exists — verify)                        |

---

## Step 7 — Admin Panel Hardening

**New API route** `src/app/api/admin/db-status/route.ts`:

- `GET` — admin-only. Runs `db.$queryRaw\`SELECT 1\`` and measures round-trip latency in ms.
- Returns `{ data: { ok: true, latencyMs: number } | { ok: false, error: string }, error }`.

**`src/components/admin/db-status-chip.tsx`** (`"use client"`):

- Fetches `GET /api/admin/db-status` on mount (lazy, not blocking page load).
- Renders a small status chip:
  - ⏳ _Checking…_ (while fetching)
  - 🟢 _DB connected · Xms_ (ok)
  - 🔴 _DB unreachable_ (error)
- Include a manual "Re-check" icon button.

**`src/components/admin/admin-import-panel.tsx`**:

- Import and render `<DbStatusChip />` at the top of the panel, before the season overview section.
- Promote the "Last successful import" timestamp to a dedicated pill/badge next to the section heading rather than
  buried in paragraph text.
- Add a human-readable relative time (e.g. _"3 minutes ago"_) next to the ISO timestamp using a small `useRelativeTime`
  hook that refreshes every minute.

---

## Step 8 — ESPN Scoreboard Group ID Discovery & Override

The scoreboard group IDs used to filter ESPN results to NCAA Tournament games (`groups=50` for Men's, `groups=49` for
Women's) are assumed values that may change between seasons. This step makes them discoverable and admin-configurable.

### Schema changes (migration required)

Add two nullable fields to `TournamentSeason`:

```prisma
mensEspnGroupId   String? // ESPN scoreboard ?groups= value for Men's NCAA Tournament; defaults to "50"
womensEspnGroupId String? // ESPN scoreboard ?groups= value for Women's NCAA Tournament; defaults to "49"
```

### `src/lib/import.ts`

- Replace the hardcoded `ESPN_TOURNAMENT_GROUP_IDS` constant with a fallback helper: `getGroupId(season, gender)` that
  returns the season's stored value when present and falls back to `"50"` / `"49"`.
- Add a new exported async function `discoverEspnGroupIds(season)` that probes candidate group IDs (e.g. `"49"`, `"50"`,
  `"100"`, `"101"`, `"102"`) against the current scoreboard endpoint for each gender, and returns the first ID that
  yields events matching the expected tournament format (events with bracket slot data). Returns
  `{ mens: string | null, womens: string | null }`.

### `src/app/api/admin/season/route.ts`

- Extend the `PATCH` handler to also accept `mensEspnGroupId` and `womensEspnGroupId` fields alongside the existing
  tournament ID fields.

### `src/app/api/admin/discover-group-ids/route.ts` (new)

- `POST` — admin-only. Calls `discoverEspnGroupIds(season)` and returns the discovered IDs without saving them. Allows
  the admin to preview the result before committing.

### `src/components/admin/admin-import-panel.tsx`

- Add a new "ESPN Group IDs" sub-section inside the existing ESPN Tournament IDs section (or as its own section).
- Two text inputs: _Men's Group ID_ and _Women's Group ID_, pre-populated from the season record (blank when null,
  implying the hardcoded fallback is used).
- A **"Auto-Discover"** button that calls `POST /api/admin/discover-group-ids`, shows the discovered values in the
  inputs, and lets the admin confirm before saving.
- Save button writes via `PATCH /api/admin/season`.

---

## Step 9 — Competition Setup: Make Correct Winner Always Active

`correct_winner` is a core scoring mode and should not be optional. Remove the checkbox for it in the Scoring Mode
section while preserving the display of its point values.

**`src/components/competition/create-competition-form.tsx`**:

- Remove `"correct_winner"` from the `toggleScoringMode` checkboxes. The Scoring Mode section should only show a
  checkbox for **Round Advancement** (optional, meaningful only with reseed mode active).
- Ensure `settings.scoring_mode` always includes `"correct_winner"` in the initial state and is never removed. Guard
  this in `getDefaultCompetitionSettings` (`src/lib/competition.ts`) and in the API validation layer
  (`src/app/api/competitions/route.ts`).
- Keep the Correct Winner point-value inputs fully editable; remove only the enable/disable checkbox.

---

## Step 10 — Competition Setup: Seeding Accuracy Bonus Checkbox

The Seeding Accuracy Bonus toggle currently uses a pill-style `<button>` (toggle switch), inconsistent with the checkbox
used for Round Advancement. Replace it with a standard checkbox for visual consistency.

**`src/components/competition/create-competition-form.tsx`**:

- Replace the toggle `<button>` for `seeding_bonus_enabled` with a `<label>` + `<input type="checkbox">` pattern, styled
  to match the Round Advancement checkbox.

---

## Step 11 — Competition Setup: Unified Points Table

Consolidate the three separate per-scoring-mode point-value tables (Round Advancement, Correct Winner, Seeding Accuracy
Bonus) into a single unified table. This reduces vertical scrolling and makes it easy to compare point values across
modes at a glance.

**`src/components/competition/create-competition-form.tsx`**:

- Replace the three individual tables with one table where:
  - **Rows** represent exit rounds, in order: First Four → Round of 64 → Round of 32 → Sweet 16 → Elite 8 → Final Four →
    Championship → Championship (Runner-up) → Championship (Winner).
  - **Columns** represent scoring modes: _Round Advancement_, _Correct Winner_, _Seeding Accuracy Bonus_.
  - The Round Advancement and Correct Winner columns use `RoundPointMap` keys (`first_four` through `championship`); the
    cells for Championship (Runner-up) and Championship (Winner) rows are disabled/greyed out for those two columns
    since `RoundPointMap` has no runner-up/winner distinction.
  - The Seeding Accuracy Bonus column uses `SeedingBonusPointMap` keys; the single `championship` row is disabled for
    that column (the bonus uses the two championship-specific rows instead).
  - Columns for Round Advancement and Seeding Accuracy Bonus are only editable when their respective mode is enabled
    (checkbox checked); when disabled, the cells are greyed out but still visible.
- Rename the seeding bonus labels: `championship_runner_up` → **"Championship (Runner-up)"** and `championship_winner` →
  **"Championship (Winner)"** so the table rows are unambiguous.

---

## Step 12 — Competition Lobby: Organizer Delete Competition

Allow an organizer to permanently delete a competition from the lobby page, but only when no entries have been submitted
(to prevent accidental loss of participant work).

### `src/app/api/competitions/[id]/route.ts`

- Add a `DELETE` handler (organizer-only). Checks that `competitionEntry` count for this competition is `0`; if any
  entries exist, return `400 { error: "Cannot delete a competition with submitted entries." }`. On success, delete the
  competition and cascade to members, invitations, and entries via Prisma's `onDelete: Cascade` rules. Return `204`.

### `src/components/competition/lobby-client.tsx`

- Add a **"Delete Competition"** button in the `LobbyOrganizerSettings` panel, visible only when the organizer is
  viewing and the entry count is `0`.
- On click, show a `window.confirm` prompt: _"Permanently delete this competition? This cannot be undone."_
- On confirm, call `DELETE /api/competitions/[id]`. On success, redirect to `/competition`.
- If entries exist (server returns `400`), surface an inline error: _"This competition has submitted entries and cannot
  be deleted."_

---

## Further Considerations

1. **Notification triggers scope** — the two wired write-path hooks (score computed, join confirmed) are the minimum.
   Consider whether to also fire a notification when a competition the user is in becomes locked (approaching `lockAt`),
   or when a new result is imported. Keeping it to score events avoids spamming users during rapid cron imports.

2. **Mobile nav approach** — a slide-out drawer adds complexity. A simpler collapsed drop-down (no slide animation) may
   be sufficient given the small number of nav links. The plan describes a drop-down; upgrade to a drawer only if needed
   after testing on device.

3. **DB status endpoint** — pinging the DB on every admin page load adds latency. The chip fetches lazily on mount
   (client-side), so it does not block SSR. This is the preferred approach and is already described in Step 7.

4. **Polling interval** — 30 s for notification polling is a reasonable default. Back off to 60 s when
   `document.visibilityState` is `"hidden"` (described in Step 2).

5. **Notification write volume** — score computation runs on every cron import. During the active tournament window
   (every 5 min), this would create a notification every 5 min per user per competition. Deduplicate by only creating
   one notification per _score-computation run_ per user, not per game (described in Step 1).

6. **ESPN group ID probe candidate list** — the discovery function in Step 8 probes a small fixed set of candidate IDs.
   If ESPN changes their group taxonomy significantly, the list may need expanding. The manual override fields exist
   precisely for this fallback.

7. **Unified points table rowspan** — the Championship (Runner-up) and Championship (Winner) rows in the merged table
   (Step 11) have no values for the Round Advancement and Correct Winner columns. Use `colspan`/`rowspan` or simply
   render disabled inputs to keep the grid regular and avoid layout complexity.
