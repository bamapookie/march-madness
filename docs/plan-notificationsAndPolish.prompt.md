# Plan: Milestone 0.7.0 — Notifications & Polish

Ship the final pre-launch milestone: in-app notification bell with client-side polling, a mobile-responsive layout pass
across all screens, Next.js loading skeletons and error boundaries on every route, polished empty states, and admin
panel hardening with DB health status.

---

## Steps

### 1. Notifications API

Create `src/app/api/notifications/route.ts`:

- `GET` — returns the current user's unread notifications (newest-first, limit 20). Response:
  `{ data: Notification[], error }`.
- `PATCH` — marks all of the current user's notifications as read. Response: `{ data: { count: number }, error }`.

Create `src/app/api/notifications/[id]/route.ts`:

- `PATCH` — marks a single notification as read.
- `DELETE` — deletes a single notification (user must own it).

Create `src/lib/notifications.ts`:

- Export `createNotification(userId: string, title: string, body: string, link?: string): Promise<void>` — thin wrapper
  around `db.notification.create`.
- Wire into existing flows:
  - **Score computation** (in `src/app/api/cron/import-results/route.ts` or the scoring helper): after scores are
    written, call `createNotification` for every user whose entry received new points, e.g. _"Scores updated — check
    your leaderboard position."_
  - **Join confirmation** (in `src/app/api/competitions/[id]/join/route.ts`): notify the joining user, e.g. _"You joined
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

### 2. Notification Bell Component

Create `src/components/nav-notifications.tsx` (`"use client"`):

- On mount and every 30 s, call `GET /api/notifications`.
- Show a bell icon (Lucide `Bell`) in the nav with an unread badge count (hidden when 0).
- Clicking the bell toggles a dropdown list of the 20 most-recent notifications, each showing title, body, relative
  time, and a deep-link if present.
- "Mark all read" button at the top of the dropdown calls `PATCH /api/notifications` then re-fetches.
- Clicking an individual notification calls `PATCH /api/notifications/[id]` (mark read) and follows `link` if present.
- If no unread notifications, show an empty state: _"You're all caught up."_

Refactor `src/components/nav.tsx`:

- Keep the outer `<header>` as a server component.
- Import and render `<NotificationBell userId={session.user.id} />` as a client island between the nav links and the
  sign-out button. Pass `userId` as a prop so the client component doesn't need to re-fetch the session.

---

### 3. Mobile-Responsive Layout Pass

**`src/components/nav.tsx`** — add a hamburger menu for `sm` and below:

- Render a `☰` / `✕` toggle button on small screens.
- Slide-out or drop-down panel containing the same links (Dashboard, My Rankings, Competitions) and the sign-out button.
- Notification bell always visible in the top bar regardless of screen size.
- Implemented with a `"use client"` `<MobileNavDrawer>` island; the outer nav shell stays a server component.

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

### 4. Loading Skeletons

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

### 5. Error Boundaries

Add `error.tsx` (`"use client"`) to the same route segments as the loading skeletons. Each file should:

- Accept `{ error, reset }` props (Next.js App Router error boundary contract).
- Display a user-friendly heading (_"Something went wrong"_), the `error.message` in a collapsed `<details>` block (dev
  only, guarded by `process.env.NODE_ENV === "development"`), a **"Try again"** button that calls `reset()`, and a **"←
  Go back"** link using `useRouter().back()`.
- Reuse a shared `src/components/ui/error-boundary-content.tsx` component so each route's `error.tsx` is a thin wrapper.

---

### 6. Empty States Audit

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

### 7. Admin Panel Hardening

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

## Further Considerations

1. **Notification triggers scope** — the two wired write-path hooks (score computed, join confirmed) are the minimum.
   Consider whether to also fire a notification when a competition the user is in becomes locked (approaching `lockAt`),
   or when a new result is imported. Keeping it to score events avoids spamming users during rapid cron imports.

2. **Mobile nav approach** — a slide-out drawer adds complexity. A simpler collapsed wrapping row (no drawer, just
   stacks) may be sufficient given the small number of nav links. If the drawer is built, implement it with CSS
   `translate` and a `useEffect` lock on `document.body` scroll, not a third-party dependency.

3. **DB status endpoint** — pinging the DB on every admin page load adds latency. The chip fetches lazily on mount
   (client-side), so it does not block SSR. This is the preferred approach and is already described in Step 7.

4. **Polling interval** — 30 s for notification polling is a reasonable default. Consider backing off to 60 s when the
   tab is not focused (use `document.visibilityState`).

5. **Notification write volume** — score computation runs on every cron import. During the active tournament window
   (every 5 min), this would create a notification every 5 min per user per competition. Deduplicate by only creating
   one notification per _score-computation run_ per user, not per game.
