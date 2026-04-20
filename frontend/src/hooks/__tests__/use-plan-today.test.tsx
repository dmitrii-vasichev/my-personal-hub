import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { usePlanToday } from "../use-plan-today";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  plannerApi: {
    getPlansToday: vi.fn(),
    patchTodayItem: vi.fn(),
  },
}));

import { plannerApi } from "@/lib/api";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePlanToday", () => {
  it("returns hasPlan=false when API throws 404-like error", async () => {
    (plannerApi.getPlansToday as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Plan not found"),
    );
    const { result } = renderHook(() => usePlanToday(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasPlan).toBe(false);
    expect(result.current.plan).toBeUndefined();
  });

  it("returns hasPlan=true when API returns a plan", async () => {
    (plannerApi.getPlansToday as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      items: [],
      planned_minutes: 0,
      completed_minutes: 0,
    });
    const { result } = renderHook(() => usePlanToday(), { wrapper });
    await waitFor(() => expect(result.current.hasPlan).toBe(true));
    expect(result.current.plan?.id).toBe(1);
  });
});
