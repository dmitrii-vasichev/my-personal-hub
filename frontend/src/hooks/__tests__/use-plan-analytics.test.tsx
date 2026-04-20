import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { usePlanAnalytics } from "../use-plan-analytics";

vi.mock("@/lib/api", () => ({
  plannerApi: { getAnalytics: vi.fn() },
}));
import { plannerApi } from "@/lib/api";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("usePlanAnalytics", () => {
  it("returns current and prior window deltas", async () => {
    (plannerApi.getAnalytics as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ avg_adherence: 0.78, days_count: 7 })
      .mockResolvedValueOnce({ avg_adherence: 0.73, days_count: 7 });

    const { result } = renderHook(() => usePlanAnalytics(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.current?.avg_adherence).toBe(0.78);
    expect(result.current.prior?.avg_adherence).toBe(0.73);
    expect(result.current.deltaPct).toBe(5);
  });

  it("returns delta=null when prior window has no data", async () => {
    (plannerApi.getAnalytics as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ avg_adherence: 0.78, days_count: 7 })
      .mockResolvedValueOnce({ avg_adherence: null, days_count: 0 });

    const { result } = renderHook(() => usePlanAnalytics(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.deltaPct).toBeNull();
  });
});
