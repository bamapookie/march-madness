# Contributing to March Madness Bracket App

Thank you for your interest in contributing! This document explains how to report issues, propose features, and submit
pull requests.

---

## Code of Conduct

Be respectful. Harassment, discrimination, or abusive behavior of any kind will not be tolerated.

---

## Reporting Bugs

1. Search [existing issues](../../issues) first — your bug may already be reported.
2. Open a new issue with:
   - A clear, descriptive title
   - Steps to reproduce
   - Expected vs. actual behaviour
   - Browser, OS, and Node.js version
   - Any relevant logs or screenshots

---

## Suggesting Features

Open an issue with the `enhancement` label and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

---

## Development Setup

See [README.md](./README.md) for full setup instructions. Quick summary:

```bash
npm install
cp .env.example .env   # fill in your values
npx prisma migrate dev
npm run dev
```

---

## Pull Request Process

1. **Fork** the repository and create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Follow the coding conventions** in [CLAUDE.md](./CLAUDE.md):
   - TypeScript strict mode — no `any` types
   - All bracket and scoring logic in `/src/lib/` — pure and testable
   - Server components by default; use `"use client"` only where needed
   - API routes return `{ data, error }` shaped responses

3. **Keep code clean:**

   ```bash
   npm run lint          # must pass with no errors
   npm run typecheck     # must pass with no errors
   npm run format:check  # must be formatted (run npm run format to fix)
   ```

4. **Write or update tests** for any changed logic in `/src/lib/`.

5. **Commit with clear messages** — prefer imperative mood:

   ```
   Add reseed-by-ranking bracket resolution
   Fix scoring engine for First Four games
   ```

6. **Open a pull request** against `main` with:
   - A description of what changed and why
   - Reference to any related issues (`Closes #123`)
   - Screenshots for UI changes

7. A maintainer will review and merge once all checks pass.

---

## Project Structure Cheat-Sheet

| Path                   | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `src/lib/bracket.ts`   | Pure bracket resolution logic — unit-testable, no DB calls |
| `src/lib/scoring.ts`   | Pure scoring logic — unit-testable, no DB calls            |
| `src/lib/import.ts`    | ESPN API import — plain async function, no scheduler       |
| `src/lib/db.ts`        | Prisma client singleton                                    |
| `src/lib/auth.ts`      | Auth.js v5 config                                          |
| `src/app/api/`         | Next.js API route handlers                                 |
| `src/types/`           | Shared TypeScript types                                    |
| `prisma/schema.prisma` | Database schema                                            |

---

## Questions?

Open a [discussion](../../discussions) or an issue labelled `question`.
