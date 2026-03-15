"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { ApiResponse } from "@/types";

type Status = "checking" | "ok" | "error";

export function DbStatusChip() {
  const [status, setStatus] = useState<Status>("checking");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function check() {
    setStatus("checking");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/db-status");
      const json = (await res.json()) as ApiResponse<
        { ok: true; latencyMs: number } | { ok: false; error: string }
      >;
      if (json.data?.ok) {
        setLatencyMs((json.data as { ok: true; latencyMs: number }).latencyMs);
        setStatus("ok");
      } else {
        setErrorMsg(
          (json.data as { ok: false; error: string } | null)?.error ?? "Connection failed"
        );
        setStatus("error");
      }
    } catch {
      setErrorMsg("Network error");
      setStatus("error");
    }
  }

  useEffect(() => {
    void check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          status === "checking"
            ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
            : status === "ok"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        {status === "checking" && "⏳ Checking DB…"}
        {status === "ok" && `🟢 DB connected · ${latencyMs}ms`}
        {status === "error" && `🔴 DB unreachable${errorMsg ? ` — ${errorMsg}` : ""}`}
      </span>
      <button
        type="button"
        onClick={() => void check()}
        disabled={status === "checking"}
        title="Re-check DB connection"
        className="rounded p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-40 dark:hover:text-zinc-300"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${status === "checking" ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
