import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use a standalone NextAuth instance built only from the edge-safe config.
// This avoids importing @/lib/auth (which pulls in pg → Node.js crypto).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/dashboard/:path*", "/ranking/:path*", "/competition/:path*", "/admin/:path*"],
};
