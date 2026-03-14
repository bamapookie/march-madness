import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { AdminImportPanel } from "@/components/admin/admin-import-panel";

/** Stale data threshold: warn if last successful import is older than 30 minutes. */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

export default async function AdminPage() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    redirect("/");
  }

  // Load active season with aggregate counts
  const season = await db.tournamentSeason.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      isActive: true,
      mensEspnTournamentId: true,
      womensEspnTournamentId: true,
      firstFourLockAt: true,
      roundOf64LockAt: true,
      _count: {
        select: {
          schools: true,
          bracketSlots: true,
          tournamentResults: true,
        },
      },
    },
  });

  // Load last import log
  const lastImport = season
    ? await db.importLog.findFirst({
        where: { seasonId: season.id },
        orderBy: { startedAt: "desc" },
        select: {
          status: true,
          schoolsUpserted: true,
          bracketSlotsUpserted: true,
          resultsUpserted: true,
          errorMessage: true,
          startedAt: true,
          completedAt: true,
        },
      })
    : null;

  // Determine stale data: last SUCCESS import > 30 min ago AND tournament in window
  const now = new Date();
  let isStale = false;
  if (season && lastImport) {
    const lastSuccessImport = await db.importLog.findFirst({
      where: { seasonId: season.id, status: "SUCCESS" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    });
    if (lastSuccessImport?.completedAt) {
      const age = now.getTime() - lastSuccessImport.completedAt.getTime();
      const tournamentEnd = new Date(season.roundOf64LockAt);
      tournamentEnd.setDate(tournamentEnd.getDate() + 21);
      isStale =
        age > STALE_THRESHOLD_MS &&
        now >= season.firstFourLockAt &&
        now <= tournamentEnd;
    }
  }

  const stats = {
    schoolCount: season?._count.schools ?? 0,
    bracketSlotCount: season?._count.bracketSlots ?? 0,
    resultCount: season?._count.tournamentResults ?? 0,
  };

  // Serialize dates to strings for client component
  const seasonForClient = season
    ? {
        id: season.id,
        name: season.name,
        isActive: season.isActive,
        mensEspnTournamentId: season.mensEspnTournamentId,
        womensEspnTournamentId: season.womensEspnTournamentId,
        firstFourLockAt: season.firstFourLockAt.toISOString(),
        roundOf64LockAt: season.roundOf64LockAt.toISOString(),
      }
    : null;

  const lastImportForClient = lastImport
    ? {
        status: lastImport.status,
        schoolsUpserted: lastImport.schoolsUpserted,
        bracketSlotsUpserted: lastImport.bracketSlotsUpserted,
        resultsUpserted: lastImport.resultsUpserted,
        errorMessage: lastImport.errorMessage,
        startedAt: lastImport.startedAt.toISOString(),
        completedAt: lastImport.completedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Admin</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">
        Import controls, stale data warnings, and season management.
      </p>

      <AdminImportPanel
        season={seasonForClient}
        stats={stats}
        lastImport={lastImportForClient}
        isStale={isStale}
      />
    </main>
  );
}
