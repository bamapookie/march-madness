# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ Yes |
| older branches | ❌ No |

This project is under active development. Only the latest code on the `main` branch receives security fixes.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

To report a security issue, contact the maintainers privately:

1. Open a [GitHub Security Advisory](../../security/advisories/new) on this repository — this keeps the report confidential until a fix is released.
2. Include as much detail as possible:
   - A description of the vulnerability
   - Steps to reproduce or a proof-of-concept
   - Potential impact
   - Any suggested mitigations

You can expect an acknowledgement within **72 hours** and a fix or mitigation plan within **14 days** for confirmed vulnerabilities.

---

## Scope

The following are **in scope**:

- Authentication and session handling (`src/lib/auth.ts`, `/api/auth/*`)
- API routes that mutate data (`/api/*`)
- Cron job authentication (`/api/cron/*`)
- Environment variable handling and secrets exposure

The following are **out of scope**:

- Vulnerabilities in third-party dependencies unrelated to this project's usage
- Theoretical attacks with no practical impact
- Issues on infrastructure outside this repository (Vercel, Railway, OAuth providers)

---

## Security Best Practices for Deployments

- **Never commit `.env`** — it is listed in `.gitignore`.
- Rotate `AUTH_SECRET` and `CRON_SECRET` if they are ever exposed.
- Use Railway's private networking for `DATABASE_URL` where possible.
- Scope OAuth apps to the minimum required permissions.
- Review Vercel environment variable access per-environment (preview vs. production).

