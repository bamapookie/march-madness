# Milestone 0.7.1 Plan — Post-Polish Fixes

Targeted fixes for bugs and rough edges surfaced after implementing 0.7.0.

---

## Fix 1 — Join Competition notification gap

**Problem:** The "Join Competition" button on the lobby page (`src/app/competition/[id]/page.tsx`) uses an inline server
action that writes directly to `competitionMember` without going through the API route. As a result it never calls
`createNotification`, so the user receives no join confirmation.

**Fix:** Replace the raw `db.competitionMember.create` call inside the inline server action with a call to
`createNotification` after the insert, mirroring what `POST /api/competitions/join` does.

**File:** `src/app/competition/[id]/page.tsx` — inline join server action.

---

## Fix 2 — Remove unnecessary checkbox from always-active Correct Winner row

**Problem:** The always-active Correct Winner row in the Scoring Options section renders a disabled, checked checkbox
next to the label. Since Correct Winner can never be toggled off, the checkbox communicates nothing useful and adds
visual noise. It also produces a React controlled-input console warning (`checked` without `onChange`) and uses
`readOnly`, which is not valid HTML for checkboxes.

**Fix:** Remove the `<input type="checkbox">` element entirely from the Correct Winner row. Keep the label text and the
"(always active)" note so the intent remains clear — just without the misleading disabled control.

**File:** `src/components/competition/create-competition-form.tsx`.

---

## Fix 3 — ESLint: `console.log` → `console.warn` in `import.ts`

**Problem:** Several `console.log` calls in `src/lib/import.ts` violate the project's ESLint rule (`no-console` allows
only `warn` and `error`). These are pre-existing but are now surfacing in IDE lint output.

Affected lines (approximate):

- `importSchools` completion log
- `importBracketSlots` completion log
- Tournament ID auto-discovery progress logs (×4)
- `importResults` completion log

**Fix:** Change all `console.log` calls in `import.ts` to `console.warn`.

**File:** `src/lib/import.ts`.

---

## Fix 4 — ESLint: unnecessary `continue` at end of loop in `discoverEspnGroupIds`

**Problem:** The inner `try/catch` in `discoverEspnGroupIds` ends with `continue` as the last statement of the `for`
loop, which ESLint flags as unnecessary.

```typescript
} catch {
  continue; // ← unnecessary — loop continues anyway
}
```

**Fix:** Remove the `continue` statement.

**File:** `src/lib/import.ts` — `discoverEspnGroupIds`.

---

## Fix 5 — `notifyScoresUpdated` should not fire before the tournament starts

**Problem:** `notifyScoresUpdated` is called at the end of every `recomputeAllScores` run. During development and
pre-tournament imports, results can be zero and `totalScore` can be zero for every entry, yet users would still receive
a "Scores updated" notification on every cron tick.

**Fix:** Inside `notifyScoresUpdated`, only proceed if at least one `EntryScore` row has `totalScore > 0`. This ensures
the notification fires only once real game results have been incorporated.

**File:** `src/lib/notifications.ts`.

---

## Fix 6 — Per-competition score notifications with leaderboard links

**Problem:** `notifyScoresUpdated` currently sends one notification per user with a generic link to `/competition` (the
list view). This is unhelpful when a user is in multiple competitions — they do not know which competition has new
scores, and the link drops them at the top level.

**Fix:** Restructure `notifyScoresUpdated` to group entries by competition. For each competition that has at least one
scored entry (with `totalScore > 0`), notify every participating user once per competition run, linking directly to that
competition's leaderboard (`/competition/[id]/leaderboard`). A user in three competitions gets at most three
notifications per scoring run — one per competition — but a user whose competition has no scores yet is not notified for
that competition.

**File:** `src/lib/notifications.ts`.

---

## Fix 7 — Points table: grey out First Four row when lock mode is "Before Round of 64"

**Problem:** When `lock_mode = "before_round_of_64"` is selected in the competition create form, the First Four point
inputs are still editable and displayed at full opacity. The domain rules state that First Four points are always
ignored in this mode, so showing editable inputs is misleading and invites organizer confusion.

**Fix:** In the unified points table, detect when `settings.lock_mode === "before_round_of_64"` and, for the "First
Four" row only, disable all three inputs and add a `line-through` / reduced-opacity style on the row label, plus a
tooltip or inline note: _"First Four points are not awarded in Before Round of 64 mode."_

**File:** `src/components/competition/create-competition-form.tsx`.

---

## Fix 8 — Show Admin link in nav for admin users

**Problem:** There is no link to `/admin` in the navigation. Admins must type the URL directly to reach the admin panel,
which is easy to forget and error-prone.

**Fix:** The nav is already a server component and can call `isAdmin` from `@/lib/admin`. Compute the flag once and pass
it where needed:

- **`src/components/nav.tsx`** — call `isAdmin(session.user.email)` after resolving the session. In the desktop nav
  links `<div>`, render a conditionally visible **Admin** link to `/admin` after the Competitions link, styled
  distinctly (e.g., a small badge outline) so it is clearly a privileged item.
- **`src/components/mobile-nav-drawer.tsx`** — add an `isAdmin: boolean` prop. Render the Admin link in the mobile
  drawer menu below the Competitions link, only when `isAdmin` is true.

The Admin link should only be rendered when `isAdmin` returns `true`; no changes to the underlying access-control logic
are needed.

**Files:**

- `src/components/nav.tsx`
- `src/components/mobile-nav-drawer.tsx`

---

1. **IDE TypeScript errors on `mensEspnGroupId`** — The JetBrains IDE reports TS2353 errors on the new
   `mensEspnGroupId`/`womensEspnGroupId` Prisma select fields, but `tsc --noEmit` passes cleanly. This is a stale IDE
   Prisma plugin cache. No code change needed; restarting the IDE or invalidating the JetBrains TypeScript service cache
   will clear it.

2. **Score notification deduplication across runs** — Fix 6 creates at most one notification per user per competition
   per scoring run. It does not prevent creating a new notification on the next import run even if the score did not
   change. Full dedup (comparing to previous score) is a future enhancement; the current approach is acceptable because
   cron runs only trigger `notifyScoresUpdated` when new results were actually imported.
