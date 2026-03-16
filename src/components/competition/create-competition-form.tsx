"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CompetitionSettings,
  RoundPointMap,
  SeedingBonusPointMap,
  ApiResponse,
  CompetitionSummary,
} from "@/types";
import { getDefaultCompetitionSettings } from "@/lib/competition";

// ─── Row definitions for the unified points table ────────────────────────────

type PointsRow = {
  label: string;
  roundKey: keyof RoundPointMap | null; // null = no cell for RA/CW columns
  bonusKey: keyof SeedingBonusPointMap | null; // null = no cell for seeding column
};

const POINTS_ROWS: PointsRow[] = [
  { label: "First Four", roundKey: "first_four", bonusKey: "first_four" },
  { label: "Round of 64", roundKey: "round_of_64", bonusKey: "round_of_64" },
  { label: "Round of 32", roundKey: "round_of_32", bonusKey: "round_of_32" },
  { label: "Sweet 16", roundKey: "sweet_16", bonusKey: "sweet_16" },
  { label: "Elite 8", roundKey: "elite_8", bonusKey: "elite_8" },
  { label: "Final Four", roundKey: "final_four", bonusKey: "final_four" },
  { label: "Championship", roundKey: "championship", bonusKey: null },
  { label: "Championship (Runner-up)", roundKey: null, bonusKey: "championship_runner_up" },
  { label: "Championship (Winner)", roundKey: null, bonusKey: "championship_winner" },
];

// ─── Time-diff helpers ────────────────────────────────────────────────────────

/** Converts a Date to the value format expected by <input type="datetime-local"> */
function toDatetimeLocal(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${m}`;
}

/** Formats the difference between two dates as the two largest non-zero units. */
function formatTimeDiff(cutoff: Date, lock: Date): string {
  const ms = lock.getTime() - cutoff.getTime();
  if (ms < 0) return "after lock";
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins < 1) return "less than a minute";
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  if (mins > 0 && parts.length < 2) parts.push(`${mins} minute${mins !== 1 ? "s" : ""}`);
  return parts.slice(0, 2).join(", ");
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateCompetitionFormProps {
  /** ISO string of the active season's first_four_lock_at, or null if unknown. */
  firstFourLockAt: string | null;
  /** ISO string of the active season's round_of_64_lock_at, or null if unknown. */
  roundOf64LockAt: string | null;
}

export function CreateCompetitionForm({
  firstFourLockAt,
  roundOf64LockAt,
}: CreateCompetitionFormProps) {
  const router = useRouter();
  const defaults = getDefaultCompetitionSettings();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCutoffAt, setJoinCutoffAt] = useState("");
  const [settings, setSettings] = useState<CompetitionSettings>(defaults);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Derived lock-time values ─────────────────────────────────────────────

  const effectiveLockDate: Date | null =
    settings.lock_mode === "before_first_four"
      ? firstFourLockAt
        ? new Date(firstFourLockAt)
        : null
      : roundOf64LockAt
        ? new Date(roundOf64LockAt)
        : null;

  const effectiveLockMax = effectiveLockDate ? toDatetimeLocal(effectiveLockDate) : undefined;

  // ─── Cutoff hint ──────────────────────────────────────────────────────────

  const cutoffHint: { text: string; variant: "info" | "error" } | null = (() => {
    if (!effectiveLockDate) return null;
    if (!joinCutoffAt) {
      return {
        text: `Lock closes at ${effectiveLockDate.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`,
        variant: "info",
      };
    }
    const cutoff = new Date(joinCutoffAt);
    const diff = formatTimeDiff(cutoff, effectiveLockDate);
    if (diff === "after lock") {
      return { text: "Cutoff must be before the lock time.", variant: "error" };
    }
    return {
      text: `Cutoff is ${diff} before the lock.`,
      variant: "info",
    };
  })();

  const cutoffAfterLock =
    !!joinCutoffAt && !!effectiveLockDate && new Date(joinCutoffAt) >= effectiveLockDate;

  function updateSettings<K extends keyof CompetitionSettings>(
    key: K,
    value: CompetitionSettings[K]
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      // When lock mode changes, clear cutoff if it would exceed the new lock time
      if (key === "lock_mode") {
        const newLock =
          value === "before_first_four"
            ? firstFourLockAt
              ? new Date(firstFourLockAt)
              : null
            : roundOf64LockAt
              ? new Date(roundOf64LockAt)
              : null;
        if (joinCutoffAt && newLock && new Date(joinCutoffAt) >= newLock) {
          setJoinCutoffAt("");
        }
      }
      return next;
    });
  }

  function updateRoundPoints(key: keyof RoundPointMap, value: number) {
    setSettings((prev) => ({ ...prev, round_points: { ...prev.round_points, [key]: value } }));
  }

  function updateCorrectWinnerPoints(key: keyof RoundPointMap, value: number) {
    setSettings((prev) => ({
      ...prev,
      correct_winner_points: { ...prev.correct_winner_points, [key]: value },
    }));
  }

  function updateSeedingBonusPoints(key: keyof SeedingBonusPointMap, value: number) {
    setSettings((prev) => ({
      ...prev,
      seeding_bonus_points: { ...prev.seeding_bonus_points, [key]: value },
    }));
  }

  function toggleRoundAdvancement(enabled: boolean) {
    setSettings((prev) => {
      const next = enabled
        ? [...new Set([...prev.scoring_mode, "round_advancement" as const])]
        : prev.scoring_mode.filter((m) => m !== "round_advancement");
      // always keep correct_winner
      return {
        ...prev,
        scoring_mode: next.includes("correct_winner") ? next : ["correct_winner", ...next],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Competition name is required.");
      return;
    }
    if (cutoffAfterLock) {
      setError("Join cutoff must be before the lock time.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          isPublic,
          joinCutoffAt: joinCutoffAt ? new Date(joinCutoffAt).toISOString() : null,
          settings,
        }),
      });

      const json = (await res.json()) as ApiResponse<CompetitionSummary>;
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to create competition.");
        return;
      }

      router.push(`/competition/${json.data!.id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const roundAdvancementEnabled = settings.scoring_mode.includes("round_advancement");

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ── Section 1: Basic ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Basic</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Competition Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. March Madness 2026 — Friends League"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description <span className="text-xs text-zinc-400">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Public Competition
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Appear in the public lobby; anyone can join before the cutoff
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPublic((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPublic ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                isPublic ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* ── Section 2: Rules ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Rules</h2>

        {/* Lock Mode */}
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Lock Mode</p>
          <div className="mt-2 space-y-2">
            {(["before_first_four", "before_round_of_64"] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="lock_mode"
                  value={mode}
                  checked={settings.lock_mode === mode}
                  onChange={() => updateSettings("lock_mode", mode)}
                  className="mt-0.5"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {mode === "before_first_four" ? (
                    <>
                      <strong>Before First Four</strong> — locks before any games; includes all 68
                      teams per gender
                    </>
                  ) : (
                    <>
                      <strong>Before Round of 64</strong> — locks after First Four; includes only 64
                      qualifiers
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Join Cutoff — placed here so the lock mode context is visible */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Join Cutoff <span className="text-xs text-zinc-400">(optional)</span>
          </label>
          <p className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
            After this time, new members cannot join and the competition becomes private. Must be
            before the lock time.
          </p>
          <input
            type="datetime-local"
            value={joinCutoffAt}
            max={effectiveLockMax}
            onChange={(e) => setJoinCutoffAt(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none dark:bg-zinc-900 dark:text-zinc-50 ${
              cutoffAfterLock
                ? "border-red-400 focus:border-red-500 dark:border-red-600"
                : "border-zinc-300 focus:border-zinc-500 dark:border-zinc-700"
            }`}
          />
          {cutoffHint && (
            <p
              className={`mt-1 text-xs ${
                cutoffHint.variant === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {cutoffHint.text}
            </p>
          )}
        </div>

        {/* Reseed Mode */}
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Reseed Mode</p>
          <div className="mt-2 space-y-2">
            {(["fixed", "reseed_by_ranking"] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="reseed_mode"
                  value={mode}
                  checked={settings.reseed_mode === mode}
                  onChange={() => updateSettings("reseed_mode", mode)}
                  className="mt-0.5"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {mode === "fixed" ? (
                    <>
                      <strong>Fixed</strong> — original predictions never change; eliminated
                      teams&apos; future slots earn no points
                    </>
                  ) : (
                    <>
                      <strong>Reseed by Ranking</strong> — eliminated teams are replaced by actual
                      advancing teams; matchups re-evaluated by original rank
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Max entries */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Max Entries per User
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={settings.max_lists_per_user}
            onChange={(e) =>
              updateSettings("max_lists_per_user", Math.max(1, parseInt(e.target.value, 10) || 1))
            }
            className="mt-1 w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Scoring toggles */}
        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Scoring Options</p>
          <div className="mt-2 space-y-2">
            {/* Correct Winner — always enabled; no checkbox needed */}
            <div className="flex items-start gap-3">
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong>Correct Winner</strong> — points for each correctly predicted game winner
                (always active)
              </span>
            </div>

            {/* Round Advancement — optional checkbox */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={roundAdvancementEnabled}
                onChange={(e) => toggleRoundAdvancement(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong>Round Advancement</strong> — points for each round a team advances, capped
                at their predicted exit (meaningful only with reseed mode)
              </span>
            </label>

            {/* Seeding Accuracy Bonus — optional checkbox */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={settings.seeding_bonus_enabled}
                onChange={(e) => updateSettings("seeding_bonus_enabled", e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">
                <strong>Seeding Accuracy Bonus</strong> — bonus points when a team exits in the
                exact round predicted
              </span>
            </label>
          </div>
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* ── Section 3: Points (unified table) ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Points</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="pb-2 text-left text-xs font-medium text-zinc-500">Round</th>
                <th className="pr-2 pb-2 text-right text-xs font-medium text-zinc-500">
                  Correct Winner
                </th>
                <th
                  className={`pr-2 pb-2 text-right text-xs font-medium transition-opacity ${
                    roundAdvancementEnabled ? "text-zinc-500" : "text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  Round Adv.
                </th>
                <th
                  className={`pb-2 text-right text-xs font-medium transition-opacity ${
                    settings.seeding_bonus_enabled
                      ? "text-zinc-500"
                      : "text-zinc-300 dark:text-zinc-700"
                  }`}
                >
                  Seeding Bonus
                </th>
              </tr>
            </thead>
            <tbody>
              {POINTS_ROWS.map((row) => {
                const isFirstFourDisabled =
                  row.label === "First Four" && settings.lock_mode === "before_round_of_64";

                return (
                  <tr
                    key={row.label}
                    className={`border-b border-zinc-100 dark:border-zinc-900 ${
                      isFirstFourDisabled ? "opacity-40" : ""
                    }`}
                    title={
                      isFirstFourDisabled
                        ? "First Four points are not awarded in Before Round of 64 mode."
                        : undefined
                    }
                  >
                    <td
                      className={`py-1.5 text-zinc-700 dark:text-zinc-300 ${
                        isFirstFourDisabled ? "line-through" : ""
                      }`}
                    >
                      {row.label}
                    </td>

                    {/* Correct Winner */}
                    <td className="py-1.5 pr-2 text-right">
                      {row.roundKey ? (
                        <input
                          type="number"
                          min={0}
                          disabled={isFirstFourDisabled}
                          value={settings.correct_winner_points[row.roundKey]}
                          onChange={(e) =>
                            updateCorrectWinnerPoints(
                              row.roundKey!,
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Round Advancement */}
                    <td className="py-1.5 pr-2 text-right">
                      {row.roundKey ? (
                        <input
                          type="number"
                          min={0}
                          disabled={!roundAdvancementEnabled || isFirstFourDisabled}
                          value={settings.round_points[row.roundKey]}
                          onChange={(e) =>
                            updateRoundPoints(
                              row.roundKey!,
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>

                    {/* Seeding Bonus */}
                    <td className="py-1.5 text-right">
                      {row.bonusKey ? (
                        <input
                          type="number"
                          min={0}
                          disabled={!settings.seeding_bonus_enabled || isFirstFourDisabled}
                          value={settings.seeding_bonus_points[row.bonusKey]}
                          onChange={(e) =>
                            updateSeedingBonusPoints(
                              row.bonusKey!,
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                        />
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || cutoffAfterLock}
          className="rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Creating…" : "Create Competition"}
        </button>
      </div>
    </form>
  );
}
