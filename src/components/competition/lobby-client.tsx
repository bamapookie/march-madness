"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw } from "lucide-react";
import type { CompetitionDetail, ApiResponse, CompetitionSummary } from "@/types";

interface Props {
  competition: CompetitionDetail;
}

export function LobbyOrganizerSettings({ competition: c }: Props) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(c.isPublic);
  const [joinCutoffAt, setJoinCutoffAt] = useState(
    c.joinCutoffAt ? new Date(c.joinCutoffAt).toISOString().slice(0, 16) : ""
  );
  const [joinCode, setJoinCode] = useState(c.joinCode);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitions/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isPublic,
          joinCutoffAt: joinCutoffAt ? new Date(joinCutoffAt).toISOString() : null,
        }),
      });
      const json = (await res.json()) as ApiResponse<CompetitionSummary>;
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to save.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRotateCode() {
    if (!window.confirm("Rotate the join code? The old code will immediately stop working."))
      return;
    setRotating(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitions/${c.id}/rotate-code`, { method: "POST" });
      const json = (await res.json()) as ApiResponse<{ joinCode: string }>;
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to rotate code.");
        return;
      }
      setJoinCode(json.data!.joinCode);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <h3 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
        Organizer Settings
      </h3>
      <div className="space-y-3">
        {/* Public toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-zinc-700 dark:text-zinc-300">Public Competition</label>
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

        {/* Join cutoff */}
        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">Join Cutoff</label>
          <input
            type="datetime-local"
            value={joinCutoffAt}
            onChange={(e) => setJoinCutoffAt(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        {/* Join code + rotate */}
        <div>
          <label className="block text-xs text-zinc-500 dark:text-zinc-400">Join Code</label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 rounded bg-zinc-100 px-2 py-1 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
              {joinCode}
            </code>
            <button
              type="button"
              onClick={() => void handleRotateCode()}
              disabled={rotating}
              title="Rotate code"
              className="rounded p-1 text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-300"
            >
              <RefreshCw className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ─── Join Code Copy Chip ──────────────────────────────────────────────────────

export function JoinCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/join/${code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      title="Copy invite link"
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 font-mono text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {code}
    </button>
  );
}

// ─── Submit Entry Action ──────────────────────────────────────────────────────

interface SubmitEntryButtonProps {
  competitionId: string;
  userLists: Array<{ id: string; name: string; lockMode: string }>;
  competitionLockMode: string;
}

export function SubmitEntryButton({
  competitionId,
  userLists,
  competitionLockMode,
}: SubmitEntryButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedLockMode =
    competitionLockMode === "before_first_four" ? "BEFORE_FIRST_FOUR" : "BEFORE_ROUND_OF_64";

  const eligibleLists = userLists.filter((l) => l.lockMode === expectedLockMode);

  async function handleSubmit(rankingListId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rankingListId }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to submit.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
      >
        Submit Entry ▾
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {eligibleLists.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">
              No eligible ranking lists found. Create a ranking list with the matching lock mode
              first.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {eligibleLists.map((list) => (
                <li key={list.id}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit(list.id)}
                    className="w-full px-4 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {list.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Entries Table ────────────────────────────────────────────────────────────

import type { CompetitionEntrySummary } from "@/types";

interface EntriesTableProps {
  competitionId: string;
  entries: CompetitionEntrySummary[];
  isOrganizer: boolean;
  isLocked: boolean;
  currentUserId: string;
}

export function EntriesTable({
  competitionId,
  entries,
  isOrganizer,
  isLocked,
  currentUserId,
}: EntriesTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(entryId: string) {
    if (!window.confirm("Remove this entry?")) return;
    setDeletingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/competitions/${competitionId}/entries/${entryId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!res.ok || json.error) {
        setError(json.error ?? "Failed to remove entry.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No entries submitted yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800">
            <th className="pb-2 font-medium">Participant</th>
            <th className="pb-2 font-medium">Ranking List</th>
            <th className="pb-2 font-medium">Submitted</th>
            {!isLocked && <th className="pb-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {entries.map((e) => {
            const canDelete = !isLocked && (isOrganizer || e.userId === currentUserId);
            return (
              <tr key={e.id}>
                <td className="py-2 text-zinc-700 dark:text-zinc-300">{e.userName ?? "Unknown"}</td>
                <td className="py-2 text-zinc-700 dark:text-zinc-300">{e.rankingListName}</td>
                <td className="py-2 text-zinc-500 dark:text-zinc-400">
                  {new Date(e.submittedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                {!isLocked && (
                  <td className="py-2 text-right">
                    {canDelete && (
                      <button
                        type="button"
                        disabled={deletingId === e.id}
                        onClick={() => void handleDelete(e.id)}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === e.id ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
