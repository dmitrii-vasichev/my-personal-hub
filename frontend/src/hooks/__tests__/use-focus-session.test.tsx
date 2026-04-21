import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";

import {
  FOCUS_ACTIVE_KEY,
  useFocusSessionActive,
  useStartFocusMutation,
  useStopFocusMutation,
} from "../use-focus-session";
import { formatFocusMinutes } from "@/types/focus-session";
import type { FocusSession } from "@/types/focus-session";

const { toastErrorSpy } = vi.hoisted(() => ({ toastErrorSpy: vi.fn() }));

vi.mock("sonner", () => ({ toast: { error: toastErrorSpy } }));

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
  focusSessionsApi: {
    start: vi.fn(),
    stop: vi.fn(),
    getActive: vi.fn(),
    getToday: vi.fn(),
  },
}));

import { focusSessionsApi } from "@/lib/api";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function makeSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 1,
    user_id: 1,
    task_id: null,
    plan_item_id: null,
    started_at: "2026-04-21T10:00:00Z",
    ended_at: null,
    planned_minutes: 25,
    auto_closed: false,
    actual_minutes: null,
    task_title: null,
    plan_item_title: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFocusSessionActive", () => {
  it("resolves a session object when API returns one", async () => {
    const session = makeSession({ id: 42, planned_minutes: 50 });
    (focusSessionsApi.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(
      session,
    );
    const { result } = renderHook(() => useFocusSessionActive(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual(session);
  });

  it("resolves null when API returns null (no active session)", async () => {
    (focusSessionsApi.getActive as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );
    const { result } = renderHook(() => useFocusSessionActive(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.data).not.toBeUndefined();
  });
});

describe("useStartFocusMutation", () => {
  it("shows the conflict toast on 409 error", async () => {
    const conflict = Object.assign(new Error("Conflict"), { status: 409 });
    (focusSessionsApi.start as ReturnType<typeof vi.fn>).mockRejectedValue(
      conflict,
    );
    const { result } = renderHook(() => useStartFocusMutation(), { wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ planned_minutes: 25 });
      } catch {
        // expected
      }
    });
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "У тебя уже идёт сессия — останови её сначала",
    );
  });

  it("shows the generic toast on non-409 errors", async () => {
    const boom = Object.assign(new Error("Server exploded"), { status: 500 });
    (focusSessionsApi.start as ReturnType<typeof vi.fn>).mockRejectedValue(
      boom,
    );
    const { result } = renderHook(() => useStartFocusMutation(), { wrapper });
    await act(async () => {
      try {
        await result.current.mutateAsync({ planned_minutes: 50 });
      } catch {
        // expected
      }
    });
    expect(toastErrorSpy).toHaveBeenCalledWith(
      "Не удалось стартовать фокус — попробуй ещё раз",
    );
  });
});

describe("useStopFocusMutation", () => {
  it("optimistically clears the active session before the API resolves", async () => {
    // Deferred promise — resolves only when we say so.
    let resolveStop: (value: FocusSession) => void = () => {};
    const pending = new Promise<FocusSession>((resolve) => {
      resolveStop = resolve;
    });
    (focusSessionsApi.stop as ReturnType<typeof vi.fn>).mockReturnValue(pending);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const seeded = makeSession({ id: 7, planned_minutes: 90 });
    qc.setQueryData(FOCUS_ACTIVE_KEY, seeded);

    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useStopFocusMutation(), {
      wrapper: wrap,
    });

    // Fire-and-forget — we don't await here so we can inspect the cache mid-flight.
    act(() => {
      result.current.mutate(7);
    });

    // onMutate is synchronous after cancelQueries; give React Query a tick to apply it.
    await waitFor(() =>
      expect(qc.getQueryData(FOCUS_ACTIVE_KEY)).toBeNull(),
    );

    // Resolve the pending API call so the test doesn't dangle.
    await act(async () => {
      resolveStop({ ...seeded, ended_at: "2026-04-21T10:25:00Z" });
      await pending;
    });
  });
});

describe("formatFocusMinutes", () => {
  it("renders minutes-only labels under an hour", () => {
    expect(formatFocusMinutes(0)).toBe("0m");
    expect(formatFocusMinutes(45)).toBe("45m");
    expect(formatFocusMinutes(59)).toBe("59m");
  });

  it("renders whole-hour labels without a minutes suffix", () => {
    expect(formatFocusMinutes(60)).toBe("1h");
    expect(formatFocusMinutes(120)).toBe("2h");
  });

  it("renders mixed h+m labels for non-round multiples", () => {
    expect(formatFocusMinutes(75)).toBe("1h 15m");
    expect(formatFocusMinutes(135)).toBe("2h 15m");
  });
});
