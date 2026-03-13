# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### In Progress

- Milestone 0.3.0 — Core Domain Logic (bracket resolution + scoring engine)

---

## [0.2.0] — 2026-03-12

### Ranking Lists

- `LockMode` enum (`BEFORE_FIRST_FOUR` / `BEFORE_ROUND_OF_64`) added to Prisma schema; migration applied
- `src/lib/ranking.ts` — pure utilities: `getAverageSeed`, `sortSchoolsByDefaultRank`, `isRankingListLocked`, `getLockAt`
- API routes:
  - `GET  /api/ranking-lists` — list user's ranking lists for the active season
  - `POST /api/ranking-lists` — create + pre-populate; enforces lock; BEFORE_ROUND_OF_64 gates on First Four results
  - `GET  /api/ranking-lists/[id]` — full list with entries and school detail
  - `PATCH /api/ranking-lists/[id]` — rename (rejected when locked)
  - `DELETE /api/ranking-lists/[id]` — delete (blocked if submitted to a competition)
  - `PUT  /api/ranking-lists/[id]/entries` — atomic reorder via delete + re-create in one transaction
- Pre-population: schools sorted ascending by average NCAA seed, then alphabetically for ties
- Lock enforcement at the API layer — mutations rejected after `firstFourLockAt` or `roundOf64LockAt`
- Drag-to-reorder UI (`@dnd-kit/sortable`) with inline name editing, gender filter, school search, and Save button
- `/ranking` page — list of ranking lists with create / edit / delete
- `/ranking/[id]` page — full drag-and-drop editor
- `src/scripts/seed-test-season.ts` + `npm run seed:test` — seeds 53 realistic 2026 tournament schools
- Added `lucide-react` for icons
- Added `RankingListSummary`, `RankingListDetail`, `SchoolSummary`, `RankingEntryWithSchool` to shared types

---

## [0.1.0] — 2026-03-11

### Foundation

- Prisma v7 schema — all tables, relations, and indexes
- Shared TypeScript types (`/src/types`)
- Prisma client singleton with `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`)
- Auth.js v5 config — Google, Apple, and Microsoft OAuth (`src/lib/auth.ts`)
- Auth route handler (`src/app/api/auth/[...nextauth]/route.ts`)
- Middleware — protects authenticated routes (`src/middleware.ts`)
- Base layout and navigation shell (`src/app/layout.tsx`, `src/components/nav.tsx`)
- Environment variable documentation (`.env.example`)
- ESLint + Prettier configuration with Tailwind CSS plugin
- `.gitignore` covering credentials, generated files, and build artifacts

---

## Upcoming Milestones

| Milestone | Description | Target |
|-----------|-------------|--------|
| **0.2.0** | Ranking Lists — create, reorder, save, lock enforcement | Before First Four |
| **0.3.0** | Core Domain Logic — bracket resolution + scoring engine + unit tests | Before First Four |
| **0.4.0** | ESPN Import & Season Setup — API client, admin trigger, Vercel Cron | Before First Four |
| **0.5.0** | Competitions — group play, invite tokens, competition lobby, dashboard | Before First Four |
| **0.6.0** | Bracket Viewer & Leaderboard — scoring display, per-gender breakdown | During tournament |
| **0.7.0** | Notifications & Polish — mobile layout, loading states, error boundaries | During tournament |
| **1.0.0** | Production Launch — Vercel + Railway, smoke test against live ESPN data | TBD |

---

[Unreleased]: https://github.com/your-org/march-madness/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/your-org/march-madness/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/your-org/march-madness/releases/tag/v0.1.0

