"use client";

import Link from "next/link";
import { Lock, Users, Trophy, Clock } from "lucide-react";
import type { CompetitionSummary } from "@/types";

interface Props {
  competition: CompetitionSummary;
}

function useCountdown(targetIso: string): string {
  const target = new Date(targetIso).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return "now";
  const days = Math.floor(diff / 86_400_000);
  const hrs = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export function CompetitionCard({ competition: c }: Props) {
  const countdown = useCountdown(c.isJoinable && c.joinCutoffAt ? c.joinCutoffAt : c.lockAt);

  const statusLabel = c.isLocked
    ? "Locked"
    : c.joinCutoffAt && new Date(c.joinCutoffAt) <= new Date()
      ? "Closed"
      : "Open";

  const statusColor = c.isLocked
    ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
    : statusLabel === "Closed"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/competition/${c.id}`}
            className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {c.name}
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {c.isLocked && <Lock className="h-3 w-3" />}
            {statusLabel}
          </span>
          {c.isOrganizer && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              Organizer
            </span>
          )}
        </div>

        {c.description && (
          <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {c.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {c.memberCount} members
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="h-3.5 w-3.5" />
            {c.entryCount} entries
          </span>
          {c.organizerName && <span>by {c.organizerName}</span>}
          {!c.isLocked && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {c.isJoinable ? `Closes ${countdown}` : `Locks ${countdown}`}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        <Link
          href={`/competition/${c.id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          View
        </Link>
      </div>
    </div>
  );
}
