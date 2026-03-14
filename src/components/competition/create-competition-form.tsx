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

const ROUND_KEYS: Array<keyof RoundPointMap> = [
  "first_four",
  "round_of_64",
  "round_of_32",
  "sweet_16",
  "elite_8",
  "final_four",
  "championship",
];

const ROUND_LABELS: Record<keyof RoundPointMap, string> = {
  first_four: "First Four",
  round_of_64: "Round of 64",
  round_of_32: "Round of 32",
  sweet_16: "Sweet 16",
  elite_8: "Elite 8",
  final_four: "Final Four",
  championship: "Championship",
};

const BONUS_KEYS: Array<keyof SeedingBonusPointMap> = [
  "first_four",
  "round_of_64",
  "round_of_32",
  "sweet_16",
  "elite_8",
  "final_four",
  "championship_runner_up",
  "championship_winner",
];

const BONUS_LABELS: Record<keyof SeedingBonusPointMap, string> = {
  first_four: "First Four",
  round_of_64: "Round of 64",
  round_of_32: "Round of 32",
  sweet_16: "Sweet 16",
  elite_8: "Elite 8",
  final_four: "Final Four",
  championship_runner_up: "Runner-up",
  championship_winner: "Champion",
};

export function CreateCompetitionForm() {
  const router = useRouter();
  const defaults = getDefaultCompetitionSettings();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinCutoffAt, setJoinCutoffAt] = useState("");
  const [settings, setSettings] = useState<CompetitionSettings>(defaults);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSettings<K extends keyof CompetitionSettings>(
    key: K,
    value: CompetitionSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
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

  function toggleScoringMode(mode: "round_advancement" | "correct_winner") {
    setSettings((prev) => {
      const current = prev.scoring_mode;
      const next = current.includes(mode) ? current.filter((m) => m !== mode) : [...current, mode];
      return { ...prev, scoring_mode: next };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Competition name is required.");
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
            onChange={(e) => setJoinCutoffAt(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* ── Section 2: Rules ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Rules</h2>

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

        <div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Scoring Mode</p>
          <div className="mt-2 space-y-2">
            {(["correct_winner", "round_advancement"] as const).map((mode) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={settings.scoring_mode.includes(mode)}
                  onChange={() => toggleScoringMode(mode)}
                  className="mt-0.5"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {mode === "correct_winner" ? (
                    <>
                      <strong>Correct Winner</strong> — points for each correctly predicted game
                      winner
                    </>
                  ) : (
                    <>
                      <strong>Round Advancement</strong> — points for each round a team advances,
                      capped at their predicted exit (meaningful only with reseed mode)
                    </>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Seeding Accuracy Bonus
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Bonus points when a team exits in the exact round predicted
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateSettings("seeding_bonus_enabled", !settings.seeding_bonus_enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.seeding_bonus_enabled
                ? "bg-zinc-900 dark:bg-zinc-50"
                : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-zinc-900 ${
                settings.seeding_bonus_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </section>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* ── Section 3: Points ── */}
      <section className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Points</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Round Advancement */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Round Advancement
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-1 text-left text-xs text-zinc-500">Round</th>
                  <th className="pb-1 text-right text-xs text-zinc-500">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ROUND_KEYS.map((key) => (
                  <tr key={key} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1 text-zinc-700 dark:text-zinc-300">{ROUND_LABELS[key]}</td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        min={0}
                        value={settings.round_points[key]}
                        onChange={(e) =>
                          updateRoundPoints(key, Math.max(0, parseInt(e.target.value, 10) || 0))
                        }
                        className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Correct Winner */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Correct Winner
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-1 text-left text-xs text-zinc-500">Round</th>
                  <th className="pb-1 text-right text-xs text-zinc-500">Pts</th>
                </tr>
              </thead>
              <tbody>
                {ROUND_KEYS.map((key) => (
                  <tr key={key} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1 text-zinc-700 dark:text-zinc-300">{ROUND_LABELS[key]}</td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        min={0}
                        value={settings.correct_winner_points[key]}
                        onChange={(e) =>
                          updateCorrectWinnerPoints(
                            key,
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Seeding Bonus */}
        {settings.seeding_bonus_enabled && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Seeding Accuracy Bonus
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="pb-1 text-left text-xs text-zinc-500">Exit Round</th>
                  <th className="pb-1 text-right text-xs text-zinc-500">Bonus Pts</th>
                </tr>
              </thead>
              <tbody>
                {BONUS_KEYS.map((key) => (
                  <tr key={key} className="border-b border-zinc-100 dark:border-zinc-900">
                    <td className="py-1 text-zinc-700 dark:text-zinc-300">{BONUS_LABELS[key]}</td>
                    <td className="py-1 text-right">
                      <input
                        type="number"
                        min={0}
                        value={settings.seeding_bonus_points[key]}
                        onChange={(e) =>
                          updateSeedingBonusPoints(
                            key,
                            Math.max(0, parseInt(e.target.value, 10) || 0)
                          )
                        }
                        className="w-16 rounded border border-zinc-300 px-2 py-0.5 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {submitting ? "Creating…" : "Create Competition"}
        </button>
      </div>
    </form>
  );
}
