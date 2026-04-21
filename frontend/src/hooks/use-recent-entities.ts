"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "hub-recent-entities";
const MAX_ENTRIES = 8;

export type EntityKind = "task" | "job";

export interface RecentEntity {
  kind: EntityKind;
  id: number;
  label: string;
  href: string;
  visitedAt: number;
}

export type RememberEntityInput = Omit<RecentEntity, "visitedAt">;

function readStorageRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseEntities(raw: string): RecentEntity[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentEntity =>
        x != null &&
        typeof x === "object" &&
        (x.kind === "task" || x.kind === "job") &&
        typeof x.id === "number" &&
        typeof x.label === "string" &&
        typeof x.href === "string" &&
        typeof x.visitedAt === "number",
    );
  } catch {
    return [];
  }
}

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

function writeStorage(list: RecentEntity[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    notify();
  } catch {
    // quota exceeded / storage disabled — non-fatal
  }
}

/**
 * Returns the last `MAX_ENTRIES` recently-visited entities sorted newest-first,
 * excluding any entity whose `href` matches the current pathname.
 */
export function useRecentEntities(): RecentEntity[] {
  const pathname = usePathname();
  const raw = useSyncExternalStore(subscribe, readStorageRaw, () => "[]");
  const all = parseEntities(raw);
  return all.filter((e) => e.href !== pathname);
}

/**
 * Upserts an entity into recent history. Pass `null` while data is loading —
 * no write occurs until the entity is fully constructed. Entries are deduped
 * by `href`, timestamped at write time, and capped at MAX_ENTRIES newest-first.
 */
export function useRememberEntity(entity: RememberEntityInput | null): void {
  const kind = entity?.kind ?? null;
  const id = entity?.id ?? null;
  const label = entity?.label ?? null;
  const href = entity?.href ?? null;

  useEffect(() => {
    if (kind == null || id == null || label == null || href == null) return;
    const prev = parseEntities(readStorageRaw());
    const existing = prev.find((e) => e.href === href);
    if (existing && existing.label === label && prev[0]?.href === href) {
      return;
    }
    const deduped = prev.filter((e) => e.href !== href);
    const fresh: RecentEntity = { kind, id, label, href, visitedAt: Date.now() };
    writeStorage([fresh, ...deduped].slice(0, MAX_ENTRIES));
  }, [kind, id, label, href]);
}
