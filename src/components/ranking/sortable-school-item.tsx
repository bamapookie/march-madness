"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import type { RankingEntryWithSchool } from "@/types";

interface Props {
  entry: RankingEntryWithSchool;
  rank: number;
  isLocked: boolean;
  isDragOverlay?: boolean;
}

export function SortableSchoolItem({ entry, rank, isLocked, isDragOverlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: isLocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "flex items-center gap-3 border-b border-zinc-100 bg-white px-4 py-2.5",
        "last:border-0 dark:border-zinc-800 dark:bg-zinc-950",
        isDragging && !isDragOverlay ? "opacity-40" : "",
        isDragOverlay ? "rounded-lg shadow-lg ring-1 ring-zinc-200 dark:ring-zinc-700" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Rank number */}
      <span className="w-8 shrink-0 text-right font-mono text-sm text-zinc-400 tabular-nums">
        {rank}
      </span>

      {/* Drag handle */}
      {isLocked ? (
        <span className="w-5 shrink-0" aria-hidden />
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-zinc-300 hover:text-zinc-500 active:cursor-grabbing dark:text-zinc-700 dark:hover:text-zinc-400"
          aria-label={`Drag ${entry.school.name} to reorder`}
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* School name */}
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
        {entry.school.name}
      </span>

      {/* Gender / seed / region badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        {entry.school.isInMensTournament && entry.school.mensSeed !== null && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            M&nbsp;#{entry.school.mensSeed}
            {entry.school.mensRegion ? ` · ${entry.school.mensRegion}` : ""}
          </span>
        )}
        {entry.school.isInWomensTournament && entry.school.womensSeed !== null && (
          <span className="inline-flex items-center rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-950 dark:text-pink-300">
            W&nbsp;#{entry.school.womensSeed}
            {entry.school.womensRegion ? ` · ${entry.school.womensRegion}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
