import { renderHook } from "@testing-library/react";
import { useMediaQuery } from "../use-media-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useMediaQuery", () => {
  let listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const addEventListener = vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
    listeners.push(cb);
  });
  const removeEventListener = vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => {
    listeners = listeners.filter((l) => l !== cb);
  });

  beforeEach(() => {
    listeners = [];
    addEventListener.mockClear();
    removeEventListener.mockClear();
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query) => ({
        matches: query === "(max-width: 959px)",
        media: query,
        addEventListener,
        removeEventListener,
      })),
    );
  });

  it("returns true when query matches", () => {
    const { result } = renderHook(() => useMediaQuery("(max-width: 959px)"));
    expect(result.current).toBe(true);
  });

  it("returns false when query doesn't match", () => {
    const { result } = renderHook(() => useMediaQuery("(min-width: 9999px)"));
    expect(result.current).toBe(false);
  });

  it("subscribes and cleans up listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 959px)"));
    expect(addEventListener).toHaveBeenCalled();
    unmount();
    expect(removeEventListener).toHaveBeenCalled();
  });

  it("returns false when matchMedia is undefined (SSR / old env)", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { result } = renderHook(() => useMediaQuery("(max-width: 959px)"));
    expect(result.current).toBe(false);
  });
});
