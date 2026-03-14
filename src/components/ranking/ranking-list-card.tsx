"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock, Pencil, Trash2, BarChart2 } from "lucide-react";

import type { RankingListSummary } from "@/types";

interface Props {
  list: RankingListSummary;
}

export function RankingListCard({ list }: Props) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const updatedAgo = (() => {
    const diff = Date.now() - new Date(list.updatedAt).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  const lockDate = new Date(list.lockAt);
  const lockLabel = lockDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${list.name}"? This cannot be undone.`)) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/ranking-lists/${list.id}`, { method: "DELETE" });
      const json = (await res.json()) as { data: unknown; error: string | null };

      if (!res.ok || json.error) {
        setDeleteError(json.error ?? "Failed to delete.");
        return;
      }

      router.refresh();
    } catch {
      setDeleteError("Network error — please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/ranking/${list.id}`}
            className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {list.name}
          </Link>
          {list.isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {list.entryCount} schools ·{" "}
          {list.lockMode === "BEFORE_FIRST_FOUR"
            ? "Locks before First Four"
            : "Locks before Round of 64"}{" "}
          · Updated {updatedAgo}
          {!list.isLocked && <> · Locks {lockLabel}</>}
        </p>
        {deleteError && <p className="mt-1 text-xs text-red-500">{deleteError}</p>}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/bracket/${list.id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Bracket
        </Link>
        <Link
          href={`/ranking/${list.id}`}
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Pencil className="h-3.5 w-3.5" />
          {list.isLocked ? "View" : "Edit"}
        </Link>
        <button
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
          aria-label={`Delete ${list.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {isDeleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
