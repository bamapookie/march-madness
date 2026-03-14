import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock, Users, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getLockAtForCompetition,
  isCompetitionLocked,
  isJoinCutoffPassed,
  canViewCompetition,
} from "@/lib/competition";
import {
  LobbyOrganizerSettings,
  JoinCodeChip,
  SubmitEntryButton,
  EntriesTable,
} from "@/components/competition/lobby-client";
import type {
  CompetitionDetail,
  CompetitionMemberSummary,
  CompetitionEntrySummary,
  CompetitionSettings,
} from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CompetitionLobbyPage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=/competition/${id}`);
  const userId = session.user.id;

  const season = await db.tournamentSeason.findFirst({ where: { isActive: true } });
  if (!season) redirect("/competition");

  const comp = await db.competition.findUnique({
    where: { id },
    include: {
      organizer: { select: { name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
      entries: {
        include: {
          user: { select: { id: true, name: true } },
          rankingList: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: "asc" },
      },
    },
  });

  if (!comp) redirect("/competition");

  const isMember = comp.members.some((m) => m.userId === userId);
  const userEntries = comp.entries.filter((e) => e.userId === userId);
  const hasEntry = userEntries.length > 0;

  if (
    !canViewCompetition(
      {
        organizerId: comp.organizerId,
        isPublic: comp.isPublic,
        joinCutoffAt: comp.joinCutoffAt,
        settingsJson: comp.settingsJson,
      },
      season,
      userId,
      isMember,
      hasEntry
    )
  ) {
    redirect("/competition");
  }

  const settings = comp.settingsJson as CompetitionSettings;
  const lockAt = getLockAtForCompetition(settings, season);
  const locked = isCompetitionLocked(settings, season);
  const cutoffPassed = isJoinCutoffPassed(comp.joinCutoffAt);
  const joinable = !locked && !cutoffPassed;
  const isOrganizer = comp.organizerId === userId;

  // Build member entry counts
  const memberEntryCounts = new Map<string, number>();
  for (const entry of comp.entries) {
    memberEntryCounts.set(entry.userId, (memberEntryCounts.get(entry.userId) ?? 0) + 1);
  }

  const members: CompetitionMemberSummary[] = comp.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    userName: m.user.name,
    userEmail: m.user.email,
    userImage: m.user.image,
    entryCount: memberEntryCounts.get(m.user.id) ?? 0,
    joinedAt: m.joinedAt.toISOString(),
  }));

  const mapEntry = (e: (typeof comp.entries)[number]): CompetitionEntrySummary => ({
    id: e.id,
    userId: e.userId,
    userName: e.user.name,
    rankingListId: e.rankingList.id,
    rankingListName: e.rankingList.name,
    submittedAt: e.submittedAt.toISOString(),
  });

  const detail: CompetitionDetail = {
    id: comp.id,
    name: comp.name,
    description: comp.description,
    isPublic: comp.isPublic,
    organizerId: comp.organizerId,
    organizerName: comp.organizer.name,
    memberCount: comp.members.length,
    entryCount: comp.entries.length,
    isLocked: locked,
    lockAt: lockAt.toISOString(),
    joinCutoffAt: comp.joinCutoffAt ? comp.joinCutoffAt.toISOString() : null,
    isJoinable: joinable,
    joinCode: comp.joinCode,
    userEntryCount: userEntries.length,
    isOrganizer,
    isMember,
    settings,
    members,
    entries: comp.entries.map(mapEntry),
    userEntries: userEntries.map(mapEntry),
  };

  // Load user's ranking lists for the Submit Entry dropdown
  const userRankingLists = isMember
    ? await db.rankingList.findMany({
        where: { userId, seasonId: season.id },
        select: { id: true, name: true, lockMode: true },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const canSubmit = isMember && !locked && userEntries.length < settings.max_lists_per_user;

  // Status banner
  const statusBanner = (() => {
    if (locked) return { text: "Locked — Tournament in progress", color: "zinc" };
    if (cutoffPassed)
      return {
        text: `Closed to new members — Entries lock ${lockAt.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
        color: "amber",
      };
    if (comp.isPublic) return { text: "Open — Anyone with the code can join", color: "emerald" };
    return { text: "Private — Share the code to invite members", color: "blue" };
  })();

  const bannerColors: Record<string, string> = {
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
    blue: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200",
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      {/* Back */}
      <Link
        href="/competition"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Competitions
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{comp.name}</h1>
          {comp.description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{comp.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <JoinCodeChip code={comp.joinCode} />
            {!locked && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Locks{" "}
                {lockAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!isMember && joinable && (
            <form
              action={async () => {
                "use server";
                await db.competitionMember.create({ data: { competitionId: id, userId } });
                redirect(`/competition/${id}`);
              }}
            >
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
              >
                Join Competition
              </button>
            </form>
          )}
          {canSubmit && (
            <SubmitEntryButton
              competitionId={id}
              userLists={userRankingLists}
              competitionLockMode={settings.lock_mode}
            />
          )}
        </div>
      </div>

      {/* Status banner */}
      <div
        className={`mb-6 rounded-lg border px-4 py-2.5 text-sm ${bannerColors[statusBanner.color]}`}
      >
        {statusBanner.text}
      </div>

      {/* Organizer settings (pre-cutoff only) */}
      {isOrganizer && !cutoffPassed && !locked && (
        <div className="mb-6">
          <LobbyOrganizerSettings competition={detail} />
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Users className="h-4 w-4" />
          {comp.members.length} members
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <Trophy className="h-4 w-4" />
          {comp.entries.length} entries
        </div>
        {locked && (
          <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Lock className="h-4 w-4" />
            Locked
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Entries */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">
            Submitted Entries
          </h2>
          <EntriesTable
            competitionId={id}
            entries={detail.entries}
            isOrganizer={isOrganizer}
            isLocked={locked}
            currentUserId={userId}
          />
        </div>

        {/* Members */}
        <div>
          <h2 className="mb-3 text-base font-semibold text-zinc-700 dark:text-zinc-300">Members</h2>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-2">
                {m.userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.userImage} alt={m.userName ?? ""} className="h-7 w-7 rounded-full" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {(m.userName ?? m.userEmail).slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {m.userName ?? m.userEmail}
                    {m.userId === comp.organizerId && (
                      <span className="ml-1 text-xs text-zinc-400">(organizer)</span>
                    )}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {m.entryCount} {m.entryCount === 1 ? "entry" : "entries"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Settings summary */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
          Competition Settings
        </summary>
        <div className="mt-3 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Lock Mode</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">
                {settings.lock_mode === "before_first_four"
                  ? "Before First Four"
                  : "Before Round of 64"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Reseed Mode</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">
                {settings.reseed_mode === "fixed" ? "Fixed" : "Reseed by Ranking"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Max Entries/User</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{settings.max_lists_per_user}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Scoring Modes</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">
                {settings.scoring_mode
                  .map((m) => (m === "correct_winner" ? "Correct Winner" : "Round Advancement"))
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Seeding Bonus</dt>
              <dd className="text-zinc-700 dark:text-zinc-300">
                {settings.seeding_bonus_enabled ? "Enabled" : "Disabled"}
              </dd>
            </div>
          </dl>
        </div>
      </details>
    </main>
  );
}
