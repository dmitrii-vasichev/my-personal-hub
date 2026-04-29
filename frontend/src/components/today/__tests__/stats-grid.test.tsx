import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect } from "vitest";
import { StatsGrid } from "../stats-grid";

vi.mock("@/hooks/use-actions", () => ({ useActions: () => ({ data: [] }) }));
vi.mock("@/hooks/use-jobs", () => ({ useJobs: () => ({ data: [] }) }));
vi.mock("@/hooks/use-notes", () => ({ useNotes: () => ({ data: [] }) }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("StatsGrid", () => {
  it("renders Actions done · today by default", () => {
    wrap(<StatsGrid />);
    expect(screen.getByText(/Actions done · today/i)).toBeInTheDocument();
  });

  it("replaces Actions done cell when replaceTasksDoneWith is provided", () => {
    wrap(
      <StatsGrid
        replaceTasksDoneWith={
          <div data-testid="planner-cell">PLAN ADHERENCE</div>
        }
      />,
    );
    expect(screen.queryByText(/Actions done · today/i)).toBeNull();
    expect(screen.getByTestId("planner-cell")).toBeInTheDocument();
  });

  it("keeps the other three cells unchanged in plan-mode", () => {
    wrap(<StatsGrid replaceTasksDoneWith={<div>P</div>} />);
    expect(screen.getByText(/Overdue actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Notes · 30d/i)).toBeInTheDocument();
    expect(screen.getByText(/Response rate · 30d/i)).toBeInTheDocument();
  });

  it("replaces Response rate cell when replaceResponseRateWith is provided", () => {
    wrap(
      <StatsGrid
        replaceResponseRateWith={
          <div data-testid="adherence-cell">PLAN ADHERENCE</div>
        }
      />,
    );
    expect(screen.queryByText(/Response rate · 30d/i)).toBeNull();
    expect(screen.getByTestId("adherence-cell")).toBeInTheDocument();
  });

  it("renders both replacements side-by-side while Overdue and Notes keep defaults", () => {
    wrap(
      <StatsGrid
        replaceResponseRateWith={
          <div data-testid="adherence-cell">PLAN ADHERENCE</div>
        }
        replaceTasksDoneWith={
          <div data-testid="focus-cell">FOCUS TODAY</div>
        }
      />,
    );
    expect(screen.getByTestId("adherence-cell")).toBeInTheDocument();
    expect(screen.getByTestId("focus-cell")).toBeInTheDocument();
    expect(screen.queryByText(/Response rate · 30d/i)).toBeNull();
    expect(screen.queryByText(/Actions done · today/i)).toBeNull();
    // Cells #1 (Overdue) and #2 (Notes) keep defaults.
    expect(screen.getByText(/Overdue actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Notes · 30d/i)).toBeInTheDocument();
  });
});
