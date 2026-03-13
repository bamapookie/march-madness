"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  variant?: "primary" | "ghost";
}

export function CreateListButton({ variant = "primary" }: Props) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/ranking-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Rankings" }),
      });

      const json = (await res.json()) as {
        data: { id: string } | null;
        error: string | null;
      };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? "Failed to create ranking list.");
        return;
      }

      router.push(`/ranking/${json.data.id}`);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => void handleCreate()}
        disabled={isCreating}
        className={[
          "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          variant === "primary"
            ? "bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
        ].join(" ")}
      >
        <Plus className="h-4 w-4" />
        {isCreating ? "Creating…" : "New Ranking List"}
      </button>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
