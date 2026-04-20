import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { usePlannerContext } from "../use-planner-context";

vi.mock("@/lib/api", () => ({ plannerApi: { getContext: vi.fn() } }));
import { plannerApi } from "@/lib/api";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe("usePlannerContext", () => {
  it("passes today's date to getContext", async () => {
    (plannerApi.getContext as ReturnType<typeof vi.fn>).mockResolvedValue({
      calendar_events: [],
      due_reminders: [],
    });
    const { result } = renderHook(() => usePlannerContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(plannerApi.getContext).toHaveBeenCalledTimes(1);
    const dateArg = (plannerApi.getContext as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
