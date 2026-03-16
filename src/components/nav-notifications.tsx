"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import type { NotificationSummary, ApiResponse } from "@/types";

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationSummary[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = (await res.json()) as ApiResponse<NotificationSummary[]>;
      if (json.data) setNotifications(json.data);
    } catch {
      // silently ignore network errors
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    function startPolling() {
      intervalRef.current = setInterval(
        () => {
          void fetchNotifications();
        },
        document.visibilityState === "hidden" ? 60_000 : 30_000
      );
    }

    startPolling();

    function handleVisibilityChange() {
      if (intervalRef.current) clearInterval(intervalRef.current);
      startPolling();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleMarkAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function handleMarkOneRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-800">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-400 dark:text-zinc-500">
                You&apos;re all caught up.
              </li>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div className="flex items-start gap-3 px-4 py-3">
                    {!n.isRead && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                    <div className={`min-w-0 ${n.isRead ? "pl-5" : ""}`}>
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{n.body}</p>
                      <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <li
                    key={n.id}
                    className={`cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 ${!n.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    onClick={() => {
                      if (!n.isRead) void handleMarkOneRead(n.id);
                      if (!n.link) setOpen(false);
                    }}
                  >
                    {n.link ? (
                      <Link href={n.link} onClick={() => setOpen(false)}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
