# 🏀 March Madness Bracket App

A web app where users rank all schools in the NCAA Men's and Women's Basketball Tournaments in a single unified list. That one ranking list automatically resolves into both a Men's and Women's bracket — the higher-ranked school always wins every matchup. No game-by-game picks.

Users compete in groups (competitions) where organizers configure scoring, reseeding rules, and entry limits. The app scores both brackets together as a combined total.

---

## Features

- **Single ranking list** — rank every tournament school once; brackets are resolved automatically
- **Men's + Women's brackets** — one list drives both simultaneously
- **Competition groups** — organizers control scoring modes, lock timing, and entry limits
- **Flexible scoring** — round advancement, correct winner, and seeding accuracy bonus points
- **Reseeding support** — slot-based or ranking-based reseeding after upsets
- **Live results** — ESPN API polling via Vercel Cron Jobs
- **OAuth sign-in** — Google, Apple, and Microsoft (no passwords)

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Framework      | Next.js 16 (App Router)                     |
| Language       | TypeScript (strict mode)                    |
| Database       | PostgreSQL (Railway)                        |
| ORM            | Prisma v7                                   |
| Auth           | Auth.js v5 (Google, Apple, Microsoft OAuth) |
| Hosting        | Vercel (app) + Railway (DB)                 |
| Results import | Vercel Cron Jobs polling ESPN API           |
| Styling        | Tailwind CSS v4                             |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [npm](https://www.npmjs.com/) v10 or later
- A PostgreSQL database (local or [Railway](https://railway.app/))
- OAuth app credentials for at least one provider (Google, Apple, or Microsoft)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/march-madness.git
cd march-madness
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all required values. See [Environment Variables](#environment-variables) below.

### 4. Set up the database

```bash
npx prisma migrate dev
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Copy `.env.example` to `.env` and populate each value:

| Variable               | Description                                                    |
|------------------------|----------------------------------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string (Railway or local)                |
| `AUTH_SECRET`          | Random secret for Auth.js — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                     |
| `APPLE_CLIENT_ID`      | Apple OAuth service ID                                         |
| `APPLE_CLIENT_SECRET`  | Contents of your Apple `.p8` key file                          |
| `MICROSOFT_CLIENT_ID`  | Microsoft Azure app (client) ID                                |
| `MICROSOFT_CLIENT_SECRET` | Microsoft Azure client secret                               |
| `MICROSOFT_TENANT_ID`  | `"common"` for any Microsoft account, or a specific tenant ID  |
| `CRON_SECRET`          | Secret to authenticate `/api/cron/*` routes — generate with `openssl rand -base64 32` |

> **Never commit `.env` to version control.** It is listed in `.gitignore`.

---

## Key Commands

```bash
# Development
npm run dev               # Start dev server (localhost:3000)

# Database
npx prisma migrate dev    # Run migrations in development
npx prisma migrate deploy # Run migrations in production
npx prisma studio         # Open Prisma DB browser
npx prisma generate       # Regenerate Prisma client after schema changes

# Build
npm run build             # prisma generate + next build

# Code quality
npm run lint              # ESLint check
npm run typecheck         # TypeScript type check
npm run format            # Prettier — format all files
npm run format:check      # Prettier — check formatting (CI)

# Results import (manual trigger for testing)
npm run import:results
```

---

## Project Structure

```
/src
  /app                    # Next.js App Router pages and layouts
    /api                  # API route handlers
      /cron               # Vercel Cron Job handlers
    /(auth)               # Login / OAuth callback pages
    /dashboard            # User dashboard
    /ranking              # Create/edit ranking list
    /bracket              # Bracket viewer
    /competition          # Competition lobby, leaderboard, create
    /admin                # Admin panel
  /components             # Shared React components
  /generated/prisma       # Auto-generated Prisma client (gitignored)
  /lib
    db.ts                 # Prisma client singleton
    auth.ts               # Auth.js v5 config
    bracket.ts            # Bracket resolution logic (pure)
    scoring.ts            # Scoring logic (pure)
    import.ts             # ESPN API import logic (plain async fn)
  /middleware.ts           # Auth middleware
  /types                  # Shared TypeScript types
/prisma
  schema.prisma           # Database schema
  /migrations             # Prisma migration files
prisma.config.ts          # Prisma v7 datasource + migrations config
```

---

## Deployment

### Vercel (app)

1. Import the repository into [Vercel](https://vercel.com/).
2. Set all environment variables in the Vercel dashboard (Settings → Environment Variables).
3. The `build` script (`prisma generate && next build`) runs automatically on each deploy.

### Railway (database)

1. Create a new PostgreSQL service in [Railway](https://railway.app/).
2. Copy the connection string into `DATABASE_URL` in Vercel's environment variables.
3. Run `npx prisma migrate deploy` after the first deploy (or wire it into your release command).

### Vercel Cron Jobs

Cron schedules are defined in `vercel.json`. The `/api/cron/import-results` route is called automatically and is protected by the `CRON_SECRET` environment variable.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on reporting bugs, suggesting features, and submitting pull requests.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a history of releases and milestone progress.

---

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
