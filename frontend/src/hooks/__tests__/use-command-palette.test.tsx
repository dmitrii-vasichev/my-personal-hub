import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  CommandPaletteProvider,
  useCommandPalette,
} from "@/hooks/use-command-palette";

const wrapper = ({ children }: { children: ReactNode }) => (
  <CommandPaletteProvider>{children}</CommandPaletteProvider>
);

describe("useCommandPalette", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts closed with empty query", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("opens on Cmd+K (metaKey)", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(result.current.open).toBe(true);
  });

  it("opens on Ctrl+K", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(result.current.open).toBe(true);
  });

  it("closing via setOpen(false) clears the query", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => {
      result.current.setOpen(true);
      result.current.setQuery("task");
    });
    expect(result.current.query).toBe("task");
    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.open).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("ignores Cmd+<other-key>", () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true }));
    });
    expect(result.current.open).toBe(false);
  });
});
