"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Lock, Save } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { SortableSchoolItem } from "./sortable-school-item";
import type { RankingEntryWithSchool } from "@/types";

interface Props {
  listId: string;
  initialName: string;
  initialEntries: RankingEntryWithSchool[];
  isLocked: boolean;
  lockAt: string; // ISO-8601
}

export function RankingEditor({ listId, initialName, initialEntries, isLocked, lockAt }: Props) {
  const router = useRouter();

  // ── Entries state ──────────────────────────────────────────────────────
  const [entries, setEntries] = useState<RankingEntryWithSchool[]>(initialEntries);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Name editing ────────────────────────────────────────────────────────
  const [name, setName] = useState(initialName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ── DnD ─────────────────────────────────────────────────────────────────
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── Filter ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "mens" | "womens">("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Filtered view (DnD always operates on full list) ───────────────────
  const visibleEntries = entries.filter((e) => {
    const matchesGender =
      genderFilter === "all" ||
      (genderFilter === "mens" && e.school.isInMensTournament) ||
      (genderFilter === "womens" && e.school.isInWomensTournament);

    const matchesSearch =
      search.trim() === "" ||
      e.school.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (e.school.shortName ?? "").toLowerCase().includes(search.trim().toLowerCase());

    return matchesGender && matchesSearch;
  });

  const isFiltered = search.trim() !== "" || genderFilter !== "all";

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setEntries((current) => {
        const oldIndex = current.findIndex((e) => e.id === active.id);
        const newIndex = current.findIndex((e) => e.id === over.id);
        return arrayMove(current, oldIndex, newIndex);
      });
      setIsDirty(true);
      setSaveSuccess(false);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/ranking-lists/${listId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedSchoolIds: entries.map((e) => e.school.id) }),
      });

      const json = (await res.json()) as { data: { entries: RankingEntryWithSchool[] } | null; error: string | null };

      if (!res.ok || json.error) {
        setSaveError(json.error ?? "Failed to save rankings.");
        return;
      }

      if (json.data) {
        setEntries(json.data.entries);
      }
      setIsDirty(false);
      setSaveSuccess(true);
      router.refresh();
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [listId, entries, router]);

  const handleNameCommit = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      setIsEditingName(false);
      if (trimmed === name || !trimmed) {
        setName(name);
        return;
      }

      setNameError(null);
      const res = await fetch(`/api/ranking-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = (await res.json()) as { data: { name: string } | null; error: string | null };
      if (!res.ok || json.error) {
        setNameError(json.error ?? "Failed to rename.");
        return;
      }
      setName(trimmed);
      router.refresh();
    },
    [name, listId, router],
  );

  const activeEntry = activeId ? entries.find((e) => e.id === activeId) ?? null : null;

  const lockDate = new Date(lockAt);
  const lockLabel = lockDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Name */}
        <div className="min-w-0 flex-1">
          {isEditingName && !isLocked ? (
            <input
              ref={nameInputRef}
              defaultValue={name}
              maxLength={80}
              autoFocus
              onBlur={(e) => void handleNameCommit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleNameCommit(e.currentTarget.value);
                if (e.key === "Escape") {
                  setIsEditingName(false);
                  setName(name);
                }
              }}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-0.5 text-2xl font-bold text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          ) : (
            <button
              onClick={() => {
                if (!isLocked) setIsEditingName(true);
              }}
              disabled={isLocked}
              title={isLocked ? "Locked" : "Click to rename"}
              className={[
                "text-left text-2xl font-bold text-zinc-900 dark:text-zinc-50",
                !isLocked &&
                  "cursor-pointer rounded px-1 -ml-1 hover:bg-zinc-100 dark:hover:bg-zinc-800",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {name}
            </button>
          )}
          {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}

          {/* Lock status */}
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {isLocked ? (
              <>
                <Lock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">
                  Locked — no further edits allowed
                </span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5" />
                Locks {lockLabel}
              </>
            )}
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            {entries.length} schools
          </p>
        </div>

        {/* Save button */}
        {!isLocked && (
          <div className="flex items-center gap-2 pt-1">
            {saveSuccess && !isDirty && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved ✓</span>
            )}
            <button
              onClick={() => void handleSave()}
              disabled={!isDirty || isSaving}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                isDirty && !isSaving
                  ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving…" : "Save Rankings"}
            </button>
          </div>
        )}
      </div>

      {/* ── Save error ── */}
      {saveError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {saveError}
        </div>
      )}

      {/* ── Locked notice ── */}
      {isLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Rankings are locked. You can still view your list but no changes can be made.
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search schools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-52 rounded-md border border-zinc-200 bg-white px-3 text-sm placeholder-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-600"
        />
        <div className="flex rounded-md border border-zinc-200 text-sm dark:border-zinc-700">
          {(["all", "mens", "womens"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={[
                "px-3 py-1.5 first:rounded-l-md last:rounded-r-md",
                genderFilter === g
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              {g === "all" ? "All" : g === "mens" ? "Men's" : "Women's"}
            </button>
          ))}
        </div>
        {isFiltered && (
          <span className="text-xs text-zinc-400">
            Showing {visibleEntries.length} of {entries.length}
          </span>
        )}
      </div>

      {/* ── Drag notice when filtered ── */}
      {isFiltered && !isLocked && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          ⚠ Drag-to-reorder is disabled while filtering. Clear the search / filter to reorder.
        </p>
      )}

      {/* ── List ── */}
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {/* Column headers */}
        <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
          <span className="w-8 shrink-0 text-right">#</span>
          <span className="w-5 shrink-0" />
          <span className="flex-1">School</span>
          <span>Seeds</span>
        </div>

        {entries.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
            No schools in this ranking list.
          </div>
        ) : isFiltered ? (
          /* Filtered: render as plain (non-draggable) list */
          <div>
            {visibleEntries.map((entry) => (
              <SortableSchoolItem
                key={entry.id}
                entry={entry}
                rank={entry.rank}
                isLocked={true /* disable drag when filtered */}
              />
            ))}
          </div>
        ) : (
          /* Full list: drag-and-drop enabled */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={entries.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {entries.map((entry, idx) => (
                <SortableSchoolItem
                  key={entry.id}
                  entry={entry}
                  rank={idx + 1}
                  isLocked={isLocked}
                />
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeEntry && (
                <SortableSchoolItem
                  entry={activeEntry}
                  rank={entries.findIndex((e) => e.id === activeEntry.id) + 1}
                  isLocked={false}
                  isDragOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* ── Unsaved reminder at bottom for long lists ── */}
      {isDirty && !isLocked && entries.length > 20 && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save Rankings"}
          </button>
        </div>
      )}
    </div>
  );
}


