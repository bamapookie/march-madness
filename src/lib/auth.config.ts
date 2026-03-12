import type { NextAuthConfig } from "next-auth";

/**
 * Minimal Auth.js config that is safe to import in the Edge runtime (middleware).
 *
 * Rules:
 *  - NO imports from @/lib/db, pg, or any Node.js-only module.
 *  - NO PrismaAdapter.
 *  - Providers list is intentionally empty — OAuth flows are handled by the
 *    full config in auth.ts. Middleware only needs to verify the session JWT.
 *
 * The `authorized` callback is the only thing the middleware uses: it receives
 * the decoded session and decides whether to allow or redirect the request.
 */
export const authConfig = {
  providers: [], // OAuth providers live in auth.ts (Node.js runtime only)
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth }) {
      // Returning false redirects unauthenticated users to pages.signIn
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

