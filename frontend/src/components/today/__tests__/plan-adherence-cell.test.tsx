import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { PlanAdherenceCell } from "../plan-adherence-cell";

const { mockA } = vi.hoisted(() => ({
  mockA: {
    isLoading: false,
    current: null as unknown,
    prior: null as unknown,
    deltaPct: null as number | null,
  },
}));

vi.mock("@/hooks/use-plan-analytics", () => ({
  usePlanAnalytics: () => mockA,
}));

beforeEach(() => {
  mockA.isLoading = false;
  mockA.current = null;
  mockA.prior = null;
  mockA.deltaPct = null;
});

describe("PlanAdherenceCell", () => {
  it("shows em-dash when no plans in current window", () => {
    render(<PlanAdherenceCell />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows adherence % and up-arrow delta", () => {
    mockA.current = { avg_adherence: 0.78 };
    mockA.deltaPct = 5;
    render(<PlanAdherenceCell />);
    expect(screen.getByText(/78%/)).toBeInTheDocument();
    expect(screen.getByText(/↑\s*5/)).toBeInTheDocument();
  });

  it("hides delta when prior window empty", () => {
    mockA.current = { avg_adherence: 0.78 };
    mockA.deltaPct = null;
    render(<PlanAdherenceCell />);
    expect(screen.queryByText(/[↑↓]/)).toBeNull();
  });
});
