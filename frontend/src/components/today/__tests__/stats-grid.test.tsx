import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect } from "vitest";
import { StatsGrid } from "../stats-grid";

vi.mock("@/hooks/use-tasks", () => ({ useTasks: () => ({ data: [] }) }));
vi.mock("@/hooks/use-jobs", () => ({ useJobs: () => ({ data: [] }) }));
vi.mock("@/hooks/use-notes", () => ({ useNotes: () => ({ data: [] }) }));
vi.mock("@/hooks/use-dashboard", () => ({
  useDashboardSummary: () => ({ data: { tasks: { overdue: 0 } } }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("StatsGrid", () => {
  it("renders Tasks done · today by default", () => {
    wrap(<StatsGrid />);
    expect(screen.getByText(/Tasks done · today/i)).toBeInTheDocument();
  });

  it("replaces Tasks done cell when replaceTasksDoneWith is provided", () => {
    wrap(
      <StatsGrid
        replaceTasksDoneWith={
          <div data-testid="planner-cell">PLAN ADHERENCE</div>
        }
      />,
    );
    expect(screen.queryByText(/Tasks done · today/i)).toBeNull();
    expect(screen.getByTestId("planner-cell")).toBeInTheDocument();
  });

  it("keeps the other three cells unchanged in plan-mode", () => {
    wrap(<StatsGrid replaceTasksDoneWith={<div>P</div>} />);
    expect(screen.getByText(/Overdue tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Notes · 30d/i)).toBeInTheDocument();
    expect(screen.getByText(/Response rate · 30d/i)).toBeInTheDocument();
  });
});
