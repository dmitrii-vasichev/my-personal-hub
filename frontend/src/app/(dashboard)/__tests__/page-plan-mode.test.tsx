import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TodayPage from "../page";

const { mockPlan } = vi.hoisted(() => ({
  mockPlan: {
    plan: null as unknown,
    hasPlan: false,
    isLoading: false,
    error: null as unknown,
  },
}));

vi.mock("@/hooks/use-plan-today", () => ({
  usePlanToday: () => mockPlan,
  useCompleteItemMutation: () => ({ mutate: vi.fn() }),
  PLAN_TODAY_KEY: ["planner", "plans", "today"],
}));
vi.mock("@/hooks/use-planner-context", () => ({
  usePlannerContext: () => ({ context: null, isLoading: false }),
}));
vi.mock("@/hooks/use-plan-analytics", () => ({
  usePlanAnalytics: () => ({
    current: null,
    deltaPct: null,
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-visibility-refetch", () => ({
  useVisibilityRefetch: () => {},
}));

vi.mock("@/components/today/hero-priority", () => ({
  HeroPriority: () => <div data-testid="hero-priority" />,
}));
vi.mock("@/components/today/hero-cells", () => ({
  HeroCells: () => <div data-testid="hero-cells" />,
}));
vi.mock("@/components/today/day-timeline", () => ({
  DayTimeline: () => <div data-testid="day-timeline" />,
}));
vi.mock("@/components/today/stats-grid", () => ({
  StatsGrid: ({ replaceTasksDoneWith }: { replaceTasksDoneWith?: React.ReactNode }) => (
    <div data-testid="stats-grid">
      {replaceTasksDoneWith ?? <span data-testid="default-tasks-done" />}
    </div>
  ),
}));
vi.mock("@/components/today/reminders-today", () => ({
  RemindersToday: () => <div data-testid="reminders-today" />,
}));
vi.mock("@/components/today/signals-feed", () => ({
  SignalsFeed: () => <div data-testid="signals-feed" />,
}));
vi.mock("@/components/today/plan-adherence-cell", () => ({
  PlanAdherenceCell: () => <div data-testid="plan-adherence-cell" />,
}));

beforeEach(() => {
  mockPlan.plan = null;
  mockPlan.hasPlan = false;
  mockPlan.isLoading = false;
  mockPlan.error = null;
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Today page · plan mode switching", () => {
  it("renders no-plan fallback when hasPlan=false", () => {
    wrap(<TodayPage />);
    expect(screen.getByText(/No plan for today/i)).toBeInTheDocument();
    expect(screen.getByTestId("hero-priority")).toBeInTheDocument();
    expect(screen.getByTestId("day-timeline")).toBeInTheDocument();
    expect(screen.queryByText(/FOCUS QUEUE/)).toBeNull();
  });

  it("renders plan mode when hasPlan=true", () => {
    mockPlan.hasPlan = true;
    mockPlan.plan = {
      id: 1,
      user_id: 1,
      date: "2026-04-20",
      available_minutes: 300,
      planned_minutes: 100,
      completed_minutes: 30,
      adherence_pct: null,
      replans_count: 0,
      categories_planned: {},
      categories_actual: {},
      items: [],
      created_at: "",
      updated_at: "",
    };
    wrap(<TodayPage />);
    expect(screen.getByText(/PLAN · 2026-04-20/)).toBeInTheDocument();
    expect(screen.queryByTestId("hero-priority")).toBeNull();
    expect(screen.queryByTestId("day-timeline")).toBeNull();
    expect(screen.getByTestId("hero-cells")).toBeInTheDocument();
    expect(screen.getByTestId("plan-adherence-cell")).toBeInTheDocument();
  });

  it("renders PlanAdherenceCell in no-plan mode too (FR-19)", () => {
    wrap(<TodayPage />);
    expect(screen.getByTestId("plan-adherence-cell")).toBeInTheDocument();
    expect(screen.queryByTestId("default-tasks-done")).toBeNull();
  });
});
