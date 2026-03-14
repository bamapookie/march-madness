/**
 * Admin access control.
 *
 * Admin emails are read from the ADMIN_EMAILS environment variable (comma-separated).
 * Fall back to an empty list if the variable is not set.
 *
 * To add admins: set ADMIN_EMAILS="email1@example.com,email2@example.com" in your
 * environment (Vercel dashboard or .env.local for development).
 *
 * Example .env.local:
 *   ADMIN_EMAILS="you@example.com"
 */

function parseAdminEmails(): readonly string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns true if the given email belongs to an admin user.
 * Comparison is case-insensitive.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = parseAdminEmails();
  return admins.includes(email.toLowerCase());
}

