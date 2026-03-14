import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isJoinable } from "@/lib/competition";

interface Props {
  params: Promise<{ code: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { code } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/join/${code}`);
  }

  const comp = await db.competition.findUnique({ where: { joinCode: code } });

  if (!comp) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
          <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">
            Invalid Join Code
          </h1>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            This join link is no longer valid or has expired.
          </p>
          <Link
            href="/competition"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Browse Competitions
          </Link>
        </div>
      </main>
    );
  }

  // Already a member → go straight to the lobby
  const existing = await db.competitionMember.findUnique({
    where: { competitionId_userId: { competitionId: comp.id, userId: session.user.id } },
  });
  if (existing) {
    redirect(`/competition/${comp.id}`);
  }

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });

  if (!season || !isJoinable(comp, season)) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <h1 className="text-lg font-semibold text-amber-800 dark:text-amber-200">
            Competition Closed
          </h1>
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            <strong>{comp.name}</strong> is no longer accepting new members.
          </p>
          <Link
            href="/competition"
            className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Browse Competitions
          </Link>
        </div>
      </main>
    );
  }

  // Perform the join server-side via a server action
  async function join() {
    "use server";
    await db.competitionMember.create({
      data: { competitionId: comp!.id, userId: session!.user!.id! },
    });
    redirect(`/competition/${comp!.id}`);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">You&apos;re invited!</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You&apos;ve been invited to join
        </p>
        <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{comp.name}</p>
        <form action={join} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Join Competition
          </button>
        </form>
        <Link
          href="/competition"
          className="mt-3 block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          No thanks
        </Link>
      </div>
    </main>
  );
}
