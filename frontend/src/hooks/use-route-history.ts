"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "hub-recent-routes";
const MAX_ENTRIES = 5;

// Must stay aligned with sidebar navSections. Unknown pathnames (typos, 404s,
// deep-links we don't surface in RECENT) are filtered out before persisting.
export const KNOWN_ROUTES = [
  "/",
  "/tasks",
  "/reminders",
  "/calendar",
  "/jobs",
  "/outreach",
  "/notes",
  "/pulse",
  "/vitals",
  "/settings",
  "/profile",
] as const;

export type KnownRoute = (typeof KNOWN_ROUTES)[number];

function isKnownRoute(path: string): path is KnownRoute {
  return (KNOWN_ROUTES as readonly string[]).includes(path);
}

function readStorageRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseHistory(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Module-level pubsub so useSyncExternalStore can notify all consumers when
// we write to localStorage (the `storage` event does not fire for same-window
// writes, so we wire our own).
const listeners = new Set<() => void>();
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function notify(): void {
  listeners.forEach((l) => l());
}

function writeStorage(list: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notify();
  } catch {
    // quota exceeded / storage disabled — non-fatal
  }
}

/**
 * Tracks the last `MAX_ENTRIES` unique visited routes in localStorage.
 * The returned list excludes the current pathname so callers can render
 * "RECENT" without showing the current page as a jump target.
 */
export function useRouteHistory(): string[] {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readStorageRaw, () => "[]");

  useEffect(() => {
    if (!pathname || !isKnownRoute(pathname)) return;
    const prev = parseHistory(readStorageRaw());
    const deduped = prev.filter((p) => p !== pathname);
    const updated = [pathname, ...deduped].slice(0, MAX_ENTRIES);
    // Bail out if nothing changed — avoids a no-op write + notify.
    if (
      prev.length === updated.length &&
      prev.every((p, i) => p === updated[i])
    ) {
      return;
    }
    writeStorage(updated);
  }, [pathname]);

  return parseHistory(raw).filter((p) => p !== pathname);
}
