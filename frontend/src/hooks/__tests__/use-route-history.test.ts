import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRouteHistory } from "@/hooks/use-route-history";

const usePathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("useRouteHistory", () => {
  beforeEach(() => {
    window.localStorage.clear();
    usePathname.mockReset();
  });

  it("returns empty history on first render at /", () => {
    usePathname.mockReturnValue("/");
    const { result } = renderHook(() => useRouteHistory());
    // After first effect runs, storage has ["/"] but returned list excludes current.
    expect(result.current).toEqual([]);
  });

  it("records visited routes and excludes the current one from the returned list", () => {
    usePathname.mockReturnValue("/tasks");
    const { rerender, result } = renderHook(() => useRouteHistory());
    expect(result.current).toEqual([]); // at /tasks, excluded

    usePathname.mockReturnValue("/jobs");
    rerender();
    // Storage now contains ["/jobs", "/tasks"], returned excludes /jobs.
    expect(result.current).toEqual(["/tasks"]);
  });

  it("dedupes repeated visits — each pathname appears at most once", () => {
    usePathname.mockReturnValue("/tasks");
    const { rerender, result } = renderHook(() => useRouteHistory());
    usePathname.mockReturnValue("/jobs");
    rerender();
    usePathname.mockReturnValue("/tasks");
    rerender();
    usePathname.mockReturnValue("/reminders");
    rerender();
    // At /reminders, storage: ["/reminders", "/tasks", "/jobs"] — /tasks dedupes.
    expect(result.current).toEqual(["/tasks", "/jobs"]);
    expect(result.current.filter((p) => p === "/tasks")).toHaveLength(1);
  });

  it("caps history at 5 unique entries", () => {
    const visits = ["/tasks", "/reminders", "/calendar", "/jobs", "/notes", "/pulse", "/settings"];
    usePathname.mockReturnValue("/");
    const { rerender, result } = renderHook(() => useRouteHistory());
    for (const path of visits) {
      usePathname.mockReturnValue(path);
      rerender();
    }
    // Final pathname /settings, returned excludes it → max 5 items - 1 current = 4.
    expect(result.current.length).toBeLessThanOrEqual(5);
    const stored = JSON.parse(window.localStorage.getItem("hub-recent-routes") ?? "[]");
    expect(stored.length).toBe(5);
    expect(stored[0]).toBe("/settings");
  });

  it("ignores unknown routes (typos, 404s) — not persisted", () => {
    usePathname.mockReturnValue("/not-a-real-route");
    const { rerender, result } = renderHook(() => useRouteHistory());
    expect(result.current).toEqual([]);
    usePathname.mockReturnValue("/");
    rerender();
    expect(result.current).toEqual([]);
    const stored = JSON.parse(window.localStorage.getItem("hub-recent-routes") ?? "[]");
    expect(stored).not.toContain("/not-a-real-route");
  });

  it("persists writes to hub-recent-routes key", () => {
    usePathname.mockReturnValue("/tasks");
    const { rerender } = renderHook(() => useRouteHistory());
    usePathname.mockReturnValue("/jobs");
    rerender();
    const stored = JSON.parse(window.localStorage.getItem("hub-recent-routes") ?? "[]");
    expect(stored).toEqual(["/jobs", "/tasks"]);
  });
});
