import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { useVisibilityRefetch } from "../use-visibility-refetch";

describe("useVisibilityRefetch", () => {
  it("invalidates listed query keys on visibility=visible", () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    renderHook(
      () =>
        useVisibilityRefetch([
          ["planner", "plans", "today"],
          ["planner", "analytics", "7d"],
        ]),
      { wrapper: wrap },
    );

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
