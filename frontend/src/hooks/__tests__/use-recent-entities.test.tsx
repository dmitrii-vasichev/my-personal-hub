import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useRecentEntities,
  useRememberEntity,
  type RecentEntity,
  type RememberEntityInput,
} from "@/hooks/use-recent-entities";

const usePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

const STORAGE_KEY = "hub-recent-entities";

function task(id: number, title: string, visitedAt = Date.now()): RecentEntity {
  return {
    kind: "task",
    id,
    label: `#${id} · ${title}`,
    href: `/tasks/${id}`,
    visitedAt,
  };
}

function job(id: number, company: string, title: string, visitedAt = Date.now()): RecentEntity {
  return {
    kind: "job",
    id,
    label: `${company} · ${title}`,
    href: `/jobs/${id}`,
    visitedAt,
  };
}

describe("useRecentEntities", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePathname.mockReset();
    usePathname.mockReturnValue("/");
  });

  it("returns empty list when storage is empty", () => {
    const { result } = renderHook(() => useRecentEntities());
    expect(result.current).toEqual([]);
  });

  it("returns parsed entities newest-first, filtering invalid shapes", () => {
    const t = task(1, "Alpha", 100);
    const j = job(2, "Acme", "Engineer", 200);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([j, t, { kind: "unknown" }, null, 42]),
    );
    const { result } = renderHook(() => useRecentEntities());
    expect(result.current).toEqual([j, t]);
  });

  it("excludes entities whose href matches current pathname", () => {
    const t1 = task(1, "Alpha", 100);
    const t2 = task(2, "Beta", 200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([t2, t1]));
    usePathname.mockReturnValue("/tasks/2");
    const { result } = renderHook(() => useRecentEntities());
    expect(result.current).toEqual([t1]);
  });
});

function input(e: RecentEntity): RememberEntityInput {
  return { kind: e.kind, id: e.id, label: e.label, href: e.href };
}

describe("useRememberEntity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePathname.mockReset();
    usePathname.mockReturnValue("/");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when entity is null (data still loading)", () => {
    renderHook(() => useRememberEntity(null));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(null);
  });

  it("persists a new entity on mount with visitedAt stamped at write time", () => {
    const t = task(1, "Alpha", 100);
    renderHook(() => useRememberEntity(input(t)));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      kind: "task",
      id: 1,
      label: "#1 · Alpha",
      href: "/tasks/1",
    });
    expect(stored[0].visitedAt).toBe(Date.now());
  });

  it("dedupes by href, moves existing entry to the front with updated label", () => {
    const t1 = task(1, "Alpha", 100);
    const j = job(2, "Acme", "Engineer", 200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([j, t1]));

    const refreshed: RememberEntityInput = { ...input(t1), label: "#1 · Alpha (renamed)" };
    renderHook(() => useRememberEntity(refreshed));

    const stored: RecentEntity[] = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject(refreshed);
    expect(stored[1]).toEqual(j);
  });

  it("caps storage at 8 newest-first", () => {
    const seed = Array.from({ length: 8 }, (_, i) => task(i + 1, `T${i + 1}`, i));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed.reverse()));

    renderHook(() => useRememberEntity(input(task(99, "New"))));

    const stored: RecentEntity[] = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    expect(stored).toHaveLength(8);
    expect(stored[0]).toMatchObject({ id: 99, label: "#99 · New" });
    // Oldest (T1) was evicted.
    expect(stored.find((e) => e.id === 1)).toBeUndefined();
  });

  it("skips the write when entity already top-of-list with identical label", () => {
    const t = task(1, "Alpha", 100);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([t]));
    const setSpy = vi.spyOn(window.localStorage.__proto__, "setItem");

    renderHook(() => useRememberEntity(input(t)));

    expect(setSpy).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });
});
