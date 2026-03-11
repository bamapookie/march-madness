import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-[calc(100vh-57px)] items-center justify-center px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          One ranking.
          <br />
          Two brackets.
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Rank every NCAA tournament school in a single list. Your ranking automatically resolves
          into both a Men&apos;s and Women&apos;s bracket — no game-by-game picks needed.
        </p>
        <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
          Compete with friends in groups scored across both tournaments combined.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/sign-in"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
