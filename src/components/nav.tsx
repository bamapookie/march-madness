import Link from "next/link";
import { auth, signIn, signOut } from "@/lib/auth";
import { NotificationBell } from "@/components/nav-notifications";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";

export default async function Nav() {
  const session = await auth();

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          March Madness
        </Link>

        {/* Desktop links + auth */}
        <div className="flex items-center gap-4">
          {session ? (
            <>
              {/* Desktop-only nav links */}
              <div className="hidden items-center gap-4 sm:flex">
                <Link
                  href="/dashboard"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Dashboard
                </Link>
                <Link
                  href="/ranking"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  My Rankings
                </Link>
                <Link
                  href="/competition"
                  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                >
                  Competitions
                </Link>
              </div>

              {/* Notification bell (always visible when logged in) */}
              <NotificationBell />

              {/* Desktop avatar + sign-out */}
              <div className="hidden items-center gap-3 border-l border-zinc-200 pl-4 sm:flex dark:border-zinc-800">
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? "User avatar"}
                    className="h-7 w-7 rounded-full"
                  />
                )}
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>

              {/* Mobile hamburger — client island */}
              <MobileNavDrawer
                userName={session.user.name ?? null}
                userImage={session.user.image ?? null}
                signOutAction={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              />
            </>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn(undefined, { redirectTo: "/dashboard" });
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign in
              </button>
            </form>
          )}
        </div>
      </nav>
    </header>
  );
}
