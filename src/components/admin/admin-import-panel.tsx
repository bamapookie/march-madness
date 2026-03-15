"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DbStatusChip } from "./db-status-chip";
import type { ApiResponse } from "@/types";

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
  mensEspnGroupId: string | null;
  womensEspnGroupId: string | null;
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
  const [mensGroupId, setMensGroupId] = useState(season?.mensEspnGroupId ?? "");
  const [womensGroupId, setWomensGroupId] = useState(season?.womensEspnGroupId ?? "");
  const [savingIds, setSavingIds] = useState(false);
  const [saveIdError, setSaveIdError] = useState<string | null>(null);
  const [saveIdSuccess, setSaveIdSuccess] = useState(false);
  const [discoveringGroupIds, setDiscoveringGroupIds] = useState(false);
  const [discoverGroupIdError, setDiscoverGroupIdError] = useState<string | null>(null);

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
          mensEspnGroupId: mensGroupId.trim() || null,
          womensEspnGroupId: womensGroupId.trim() || null,
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

  async function handleDiscoverGroupIds() {
    setDiscoveringGroupIds(true);
    setDiscoverGroupIdError(null);
    try {
      const res = await fetch("/api/admin/discover-group-ids", { method: "POST" });
      const json = (await res.json()) as ApiResponse<{
        mens: string | null;
        womens: string | null;
      }>;
      if (!res.ok || json.error) {
        setDiscoverGroupIdError(json.error ?? "Discovery failed");
        return;
      }
      if (json.data?.mens) setMensGroupId(json.data.mens);
      if (json.data?.womens) setWomensGroupId(json.data.womens);
    } catch {
      setDiscoverGroupIdError("Network error — please try again.");
    } finally {
      setDiscoveringGroupIds(false);
    }
  }

  const lastSuccessAt = lastImport?.status === "SUCCESS" ? lastImport.completedAt : null;

  return (
    <div className="mt-8 space-y-8">
      {/* DB connection status */}
      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Database Connection
          </h2>
          <DbStatusChip />
        </div>
      </section>

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
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">{stats.resultCount}</dd>
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

      {/* ESPN IDs (tournament IDs + group IDs) */}
      {season && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            ESPN Configuration
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set manually, or leave blank to auto-discover on the next import / discovery run.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {/* Tournament IDs */}
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
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
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
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            {/* Scoreboard group IDs */}
            <div>
              <label
                htmlFor="mens-group-id"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Men's Scoreboard Group ID{" "}
                <span className="font-normal text-zinc-400">(blank = use default "50")</span>
              </label>
              <input
                id="mens-group-id"
                type="text"
                value={mensGroupId}
                onChange={(e) => setMensGroupId(e.target.value)}
                placeholder="50"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="womens-group-id"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Women's Scoreboard Group ID{" "}
                <span className="font-normal text-zinc-400">(blank = use default "49")</span>
              </label>
              <input
                id="womens-group-id"
                type="text"
                value={womensGroupId}
                onChange={(e) => setWomensGroupId(e.target.value)}
                placeholder="49"
                className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => void handleDiscoverGroupIds()}
              disabled={discoveringGroupIds}
              className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {discoveringGroupIds ? "Discovering…" : "Auto-Discover Group IDs"}
            </button>
            <button
              onClick={() => void handleSaveIds()}
              disabled={savingIds}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingIds ? "Saving…" : "Save ESPN Settings"}
            </button>
          </div>
          {discoverGroupIdError && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
              Discovery: {discoverGroupIdError}
            </p>
          )}
          {saveIdSuccess && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">Saved successfully.</p>
          )}
          {saveIdError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">Error: {saveIdError}</p>
          )}
        </section>
      )}

      {/* Import controls */}
      {season && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Results Import
              </h2>
              {lastSuccessAt && (
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Last successful import:{" "}
                  <span className="font-medium text-zinc-600 dark:text-zinc-300">
                    {new Date(lastSuccessAt).toLocaleString()}
                  </span>
                </p>
              )}
            </div>
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
