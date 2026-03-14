"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AdminStats = {
  schoolCount: number;
  bracketSlotCount: number;
  resultCount: number;
};

type LastImport = {
  status: "SUCCESS" | "FAILURE";
  schoolsUpserted: number;
  bracketSlotsUpserted: number;
  resultsUpserted: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
} | null;

type SeasonInfo = {
  id: string;
  name: string;
  mensEspnTournamentId: string | null;
  womensEspnTournamentId: string | null;
  isActive: boolean;
  firstFourLockAt: string;
  roundOf64LockAt: string;
};

type Props = {
  season: SeasonInfo | null;
  stats: AdminStats;
  lastImport: LastImport;
  /** True when last SUCCESS import is > 30 min ago and tournament is in progress. */
  isStale: boolean;
};

export function AdminImportPanel({ season, stats, lastImport, isStale }: Props) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [mensId, setMensId] = useState(season?.mensEspnTournamentId ?? "");
  const [womensId, setWomensId] = useState(season?.womensEspnTournamentId ?? "");
  const [savingIds, setSavingIds] = useState(false);
  const [saveIdError, setSaveIdError] = useState<string | null>(null);
  const [saveIdSuccess, setSaveIdSuccess] = useState(false);

  async function handleImport() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/admin/import", { method: "POST" });
      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok || json.error) {
        setImportError(json.error ?? "Import failed");
      } else {
        router.refresh();
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Network error");
    } finally {
      setImporting(false);
    }
  }

  async function handleSaveIds() {
    setSavingIds(true);
    setSaveIdError(null);
    setSaveIdSuccess(false);
    try {
      const res = await fetch("/api/admin/season", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensEspnTournamentId: mensId.trim() || null,
          womensEspnTournamentId: womensId.trim() || null,
        }),
      });
      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok || json.error) {
        setSaveIdError(json.error ?? "Save failed");
      } else {
        setSaveIdSuccess(true);
        router.refresh();
      }
    } catch (err) {
      setSaveIdError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingIds(false);
    }
  }

  const lastSuccessAt = lastImport?.status === "SUCCESS" ? lastImport.completedAt : null;

  return (
    <div className="mt-8 space-y-8">
      {/* Season overview */}
      {season ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Active Season: {season.name}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Schools</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{stats.schoolCount}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Bracket Slots</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {stats.bracketSlotCount}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Results</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {stats.resultCount}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">First Four Lock</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {new Date(season.firstFourLockAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Round of 64 Lock</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {new Date(season.roundOf64LockAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">No active season. Seed one with npm run seed:test.</p>
      )}

      {/* ESPN Tournament IDs */}
      {season && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ESPN Tournament IDs
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set manually after Selection Sunday, or leave blank to auto-discover on the next import.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="mens-id"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Men's Tournament ID
              </label>
              <input
                id="mens-id"
                type="text"
                value={mensId}
                onChange={(e) => setMensId(e.target.value)}
                placeholder="e.g. 401694027"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="womens-id"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Women's Tournament ID
              </label>
              <input
                id="womens-id"
                type="text"
                value={womensId}
                onChange={(e) => setWomensId(e.target.value)}
                placeholder="e.g. 401694028"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <button
              onClick={() => void handleSaveIds()}
              disabled={savingIds}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingIds ? "Saving…" : "Save IDs"}
            </button>
            {saveIdSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">Saved successfully.</p>
            )}
            {saveIdError && (
              <p className="text-sm text-red-600 dark:text-red-400">Error: {saveIdError}</p>
            )}
          </div>
        </section>
      )}

      {/* Import controls */}
      {season && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Results Import
            </h2>
            {isStale && (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                ⚠ Stale data
              </span>
            )}
          </div>

          {/* Last import status */}
          {lastImport ? (
            <div className="mt-4 text-sm">
              <p className="text-zinc-500 dark:text-zinc-400">
                Last import:{" "}
                <span
                  className={
                    lastImport.status === "SUCCESS"
                      ? "font-medium text-green-600 dark:text-green-400"
                      : "font-medium text-red-600 dark:text-red-400"
                  }
                >
                  {lastImport.status}
                </span>{" "}
                {lastImport.completedAt
                  ? `at ${new Date(lastImport.completedAt).toLocaleString()}`
                  : "(in progress)"}
              </p>
              {lastImport.status === "SUCCESS" && (
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                  {lastImport.schoolsUpserted} schools · {lastImport.bracketSlotsUpserted} bracket
                  slots · {lastImport.resultsUpserted} results
                </p>
              )}
              {lastImport.errorMessage && (
                <p className="mt-2 rounded bg-red-50 p-2 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                  {lastImport.errorMessage}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              No imports have run yet.
            </p>
          )}

          {lastSuccessAt && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Last successful import: {new Date(lastSuccessAt).toLocaleString()}
            </p>
          )}

          <div className="mt-4">
            <button
              onClick={() => void handleImport()}
              disabled={importing}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {importing ? "Importing…" : "Run Import Now"}
            </button>
          </div>

          {importError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Error: {importError}</p>
          )}
        </section>
      )}
    </div>
  );
}

