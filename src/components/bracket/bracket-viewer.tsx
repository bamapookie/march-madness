"use client";

import { useState } from "react";
import type { ResolvedBracketData, ResolvedGame, ActualResultItem } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  resolvedBracketMens: ResolvedBracketData | null;
  resolvedBracketWomens: ResolvedBracketData | null;
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[];
  /** schoolId → display name */
  schoolNames: Record<string, string>;
  /** When true, show correct/wrong/in-progress chip overlays */
  showScore?: boolean;
}

type ChipStatus = "correct" | "wrong" | "in_progress" | "pending";

// ─── Round display helpers ────────────────────────────────────────────────────

const ROUND_LABELS: Record<string, string> = {
  FIRST_FOUR: "First Four",
  ROUND_OF_64: "Round of 64",
  ROUND_OF_32: "Round of 32",
  SWEET_16: "Sweet 16",
  ELITE_8: "Elite Eight",
  FINAL_FOUR: "Final Four",
  CHAMPIONSHIP: "Championship",
};

const REGION_ROUNDS = ["FIRST_FOUR", "ROUND_OF_64", "ROUND_OF_32", "SWEET_16", "ELITE_8"] as const;
const NATIONAL_ROUNDS = ["FINAL_FOUR", "CHAMPIONSHIP"] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: ChipStatus }) {
  if (status === "correct") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ Correct
      </span>
    );
  }
  if (status === "wrong") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
        ✗ Wrong
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        ⏱ In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
      Upcoming
    </span>
  );
}

function GameSlot({
  game,
  schoolNames,
  actualResultMap,
  inProgressSet,
  showScore,
}: {
  game: ResolvedGame;
  schoolNames: Record<string, string>;
  actualResultMap: Map<string, ActualResultItem>;
  inProgressSet: Set<string>;
  showScore: boolean;
}) {
  const actual = actualResultMap.get(game.slotId);
  const inProgress = inProgressSet.has(game.slotId);

  const chipStatus: ChipStatus = (() => {
    if (inProgress) return "in_progress";
    if (!actual) return "pending";
    return actual.winningSchoolId === game.predictedWinnerId ? "correct" : "wrong";
  })();

  const topName = schoolNames[game.topContestantId] ?? game.topContestantId.slice(0, 8);
  const bottomName = schoolNames[game.bottomContestantId] ?? game.bottomContestantId.slice(0, 8);
  const winnerIsTop = game.predictedWinnerId === game.topContestantId;

  return (
    <div className="rounded border border-zinc-200 bg-white p-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <div
        className={`truncate py-0.5 ${winnerIsTop ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        {topName}
      </div>
      <div className="my-0.5 border-t border-zinc-100 dark:border-zinc-800" />
      <div
        className={`truncate py-0.5 ${!winnerIsTop ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        {bottomName}
      </div>
      {showScore && (
        <div className="mt-1.5">
          <StatusChip status={chipStatus} />
        </div>
      )}
    </div>
  );
}

function RegionView({
  region,
  bracket,
  schoolNames,
  actualResultMap,
  inProgressSet,
  showScore,
}: {
  region: string;
  bracket: ResolvedBracketData;
  schoolNames: Record<string, string>;
  actualResultMap: Map<string, ActualResultItem>;
  inProgressSet: Set<string>;
  showScore: boolean;
}) {
  const roundsToShow = bracket.games.some((g) => g.round === "FIRST_FOUR" && g.region === region)
    ? REGION_ROUNDS
    : (["ROUND_OF_64", "ROUND_OF_32", "SWEET_16", "ELITE_8"] as const);

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
      <h4 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">{region}</h4>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {roundsToShow.map((round) => {
          const games = bracket.games
            .filter((g) => g.round === round && g.region === region)
            .sort((a, b) => a.slotIndex - b.slotIndex);
          if (games.length === 0) return null;
          return (
            <div key={round} className="min-w-[120px]">
              <p className="mb-2 text-[10px] font-medium tracking-wide whitespace-nowrap text-zinc-400 uppercase dark:text-zinc-500">
                {ROUND_LABELS[round]}
              </p>
              <div className="space-y-2">
                {games.map((g) => (
                  <GameSlot
                    key={g.slotId}
                    game={g}
                    schoolNames={schoolNames}
                    actualResultMap={actualResultMap}
                    inProgressSet={inProgressSet}
                    showScore={showScore}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NationalView({
  bracket,
  schoolNames,
  actualResultMap,
  inProgressSet,
  showScore,
}: {
  bracket: ResolvedBracketData;
  schoolNames: Record<string, string>;
  actualResultMap: Map<string, ActualResultItem>;
  inProgressSet: Set<string>;
  showScore: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50">
      <h4 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Final Four &amp; Championship
      </h4>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {NATIONAL_ROUNDS.map((round) => {
          const games = bracket.games
            .filter((g) => g.round === round)
            .sort((a, b) => a.slotIndex - b.slotIndex);
          if (games.length === 0) return null;
          return (
            <div key={round} className="min-w-[120px]">
              <p className="mb-2 text-[10px] font-medium tracking-wide whitespace-nowrap text-zinc-400 uppercase dark:text-zinc-500">
                {ROUND_LABELS[round]}
              </p>
              <div className="space-y-2">
                {games.map((g) => (
                  <GameSlot
                    key={g.slotId}
                    game={g}
                    schoolNames={schoolNames}
                    actualResultMap={actualResultMap}
                    inProgressSet={inProgressSet}
                    showScore={showScore}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenderBracket({
  bracket,
  schoolNames,
  actualResults,
  inProgressSlotIds,
  showScore,
}: {
  bracket: ResolvedBracketData;
  schoolNames: Record<string, string>;
  actualResults: ActualResultItem[];
  inProgressSlotIds: string[];
  showScore: boolean;
}) {
  const actualResultMap = new Map<string, ActualResultItem>(
    actualResults.map((r) => [r.bracketSlotId, r])
  );
  const inProgressSet = new Set(inProgressSlotIds);

  // Collect unique regions in order of first appearance
  const regions: string[] = [];
  for (const g of bracket.games) {
    if (g.region && !regions.includes(g.region)) regions.push(g.region);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {regions.map((region) => (
          <RegionView
            key={region}
            region={region}
            bracket={bracket}
            schoolNames={schoolNames}
            actualResultMap={actualResultMap}
            inProgressSet={inProgressSet}
            showScore={showScore}
          />
        ))}
      </div>
      <NationalView
        bracket={bracket}
        schoolNames={schoolNames}
        actualResultMap={actualResultMap}
        inProgressSet={inProgressSet}
        showScore={showScore}
      />
    </div>
  );
}

// ─── BracketViewer (main export) ──────────────────────────────────────────────

export function BracketViewer({
  resolvedBracketMens,
  resolvedBracketWomens,
  actualResults,
  inProgressSlotIds,
  schoolNames,
  showScore = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<"mens" | "womens">("mens");

  if (!resolvedBracketMens && !resolvedBracketWomens) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        Bracket not yet available — check back after the competition locks.
      </div>
    );
  }

  const activeBracket = activeTab === "mens" ? resolvedBracketMens : resolvedBracketWomens;

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
        {(["mens", "womens"] as const).map((tab) => {
          const label = tab === "mens" ? "Men's" : "Women's";
          const bracket = tab === "mens" ? resolvedBracketMens : resolvedBracketWomens;
          if (!bracket) return null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Bracket content */}
      {activeBracket ? (
        <GenderBracket
          bracket={activeBracket}
          schoolNames={schoolNames}
          actualResults={actualResults}
          inProgressSlotIds={inProgressSlotIds}
          showScore={showScore}
        />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {activeTab === "mens" ? "Men's" : "Women's"} bracket not yet available.
        </div>
      )}
    </div>
  );
}
