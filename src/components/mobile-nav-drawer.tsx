"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

interface Props {
  /** Server-action for sign-out; passed down so the drawer stays a client component. */
  signOutAction: () => Promise<void>;
  userName: string | null;
  userImage: string | null;
  isAdmin?: boolean;
}

export function MobileNavDrawer({ signOutAction, userName, userImage, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Hamburger toggle */}
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 sm:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`fixed inset-x-0 top-[57px] z-50 border-b border-zinc-200 bg-white px-4 pt-2 pb-4 shadow-lg transition-transform sm:hidden dark:border-zinc-800 dark:bg-zinc-950 ${
          open ? "translate-y-0" : "-translate-y-[110%]"
        }`}
        style={{ transition: "transform 200ms ease" }}
      >
        <nav className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
          <Link
            href="/ranking"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            My Rankings
          </Link>
          <Link
            href="/competition"
            onClick={() => setOpen(false)}
            className="rounded-md px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Competitions
          </Link>
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2.5 text-sm font-medium text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
            >
              Admin
            </Link>
          )}

          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />

          <div className="flex items-center gap-3 px-3 py-2">
            {userImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} alt={userName ?? "User"} className="h-7 w-7 rounded-full" />
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {userName ?? "Account"}
            </span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </>
  );
}
