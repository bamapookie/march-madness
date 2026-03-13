import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAverageSeed, getLockAt, isRankingListLocked } from "@/lib/ranking";
import { RankingEditor } from "@/components/ranking/ranking-editor";
import type { RankingEntryWithSchool, SchoolSummary } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const list = await db.rankingList.findUnique({ where: { id }, select: { name: true } });
  return { title: list ? `${list.name} — March Madness` : "Ranking List — March Madness" };
}

export default async function RankingEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;

  const list = await db.rankingList.findUnique({
    where: { id },
    include: {
      season: true,
      entries: {
        include: { school: true },
        orderBy: { rank: "asc" },
      },
    },
  });

  if (!list) notFound();
  if (list.userId !== session.user.id) notFound(); // treat as not found to avoid leaking IDs

  const isLocked = isRankingListLocked(list.season, list.lockMode);
  const lockAt = getLockAt(list.season, list.lockMode);

  const entries: RankingEntryWithSchool[] = list.entries.map((e) => {
    const school: SchoolSummary = {
      id: e.school.id,
      name: e.school.name,
      shortName: e.school.shortName,
      abbreviation: e.school.abbreviation,
      isInMensTournament: e.school.isInMensTournament,
      isInWomensTournament: e.school.isInWomensTournament,
      mensSeed: e.school.mensSeed,
      womensSeed: e.school.womensSeed,
      mensRegion: e.school.mensRegion,
      womensRegion: e.school.womensRegion,
      averageSeed: getAverageSeed(e.school),
    };
    return { id: e.id, rank: e.rank, school };
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Back link */}
      <Link
        href="/ranking"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        <ArrowLeft className="h-4 w-4" />
        My Ranking Lists
      </Link>

      <RankingEditor
        listId={list.id}
        initialName={list.name}
        initialEntries={entries}
        isLocked={isLocked}
        lockAt={lockAt.toISOString()}
      />
    </main>
  );
}
