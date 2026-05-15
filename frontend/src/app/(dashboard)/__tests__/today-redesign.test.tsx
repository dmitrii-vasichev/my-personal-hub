import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import TodayPage from "../page";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

const { mockVitalsToday, healthFactoidsProps } = vi.hoisted(() => ({
  mockVitalsToday: {
    data: null as
      | {
          metrics: VitalsDailyMetric | null;
          sleep: VitalsSleep | null;
          recent_activities: [];
        }
      | null,
    isLoading: false,
  },
  healthFactoidsProps: [] as Array<{
    metrics: VitalsDailyMetric | null | undefined;
    sleep: VitalsSleep | null | undefined;
    isLoading: boolean;
  }>,
}));

const metrics: VitalsDailyMetric = {
  id: 1,
  date: "2026-05-15",
  steps: 8123,
  distance_m: 6200,
  calories_active: 510,
  calories_total: 2310,
  floors_climbed: 7,
  intensity_minutes: 41,
  resting_hr: 51,
  avg_hr: 82,
  max_hr: 151,
  min_hr: 43,
  avg_stress: 29,
  max_stress: 73,
  body_battery_high: 91,
  body_battery_low: 34,
  hrv_last_night_avg: 68,
  hrv_weekly_avg: 64,
  hrv_status: "Balanced",
  vo2_max: 49,
  training_readiness: 77,
  training_readiness_level: "High",
  training_readiness_recovery_hours: 12,
  training_readiness_feedback: "Ready for work",
};

const sleep: VitalsSleep = {
  id: 2,
  date: "2026-05-15",
  duration_seconds: 27000,
  deep_seconds: 5400,
  light_seconds: 14400,
  rem_seconds: 5400,
  awake_seconds: 1800,
  sleep_score: 83,
  start_time: "2026-05-14T23:10:00Z",
  end_time: "2026-05-15T06:40:00Z",
};

vi.mock("@/hooks/use-vitals", () => ({
  VITALS_KEY: "vitals",
  useVitalsToday: () => mockVitalsToday,
}));

vi.mock("@/hooks/use-plan-today", () => ({
  usePlanToday: () => ({
    plan: null,
    hasPlan: false,
    isLoading: false,
    error: null,
  }),
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

vi.mock("@/components/today/health-factoids", () => ({
  TodayHealthFactoids: ({
    metrics,
    sleep,
    isLoading,
  }: {
    metrics: VitalsDailyMetric | null | undefined;
    sleep: VitalsSleep | null | undefined;
    isLoading: boolean;
  }) => {
    healthFactoidsProps.push({ metrics, sleep, isLoading });
    return (
      <section data-testid="today-health-factoids">
        <span>Health factoids</span>
        <span>weekly hrv {metrics?.hrv_weekly_avg}</span>
        <span>last night hrv {metrics?.hrv_last_night_avg}</span>
        <span>sleep score {sleep?.sleep_score}</span>
      </section>
    );
  },
}));
vi.mock("@/components/today/quick-add-today-action-form", () => ({
  QuickAddTodayActionForm: () => (
    <form data-testid="quick-add-today-action-form">Quick add</form>
  ),
}));
vi.mock("@/components/today/actions-today", () => ({
  ActionsToday: () => <section data-testid="actions-today">Actions Today</section>,
}));

vi.mock("@/components/today/hero-priority", () => ({
  HeroPriority: () => <div data-testid="hero-priority">Job Hunt priority</div>,
}));
vi.mock("@/components/today/hero-cells", () => ({
  HeroCells: () => <div data-testid="hero-cells">Job Hunt factoids</div>,
}));
vi.mock("@/components/today/day-timeline", () => ({
  DayTimeline: () => <div data-testid="day-timeline">Timeline Today</div>,
}));
vi.mock("@/components/today/stats-grid", () => ({
  StatsGrid: () => <div data-testid="stats-grid">Job Hunt stats</div>,
}));
vi.mock("@/components/today/reminders-today", () => ({
  RemindersToday: () => <div data-testid="reminders-today">Reminders Today</div>,
}));
vi.mock("@/components/today/signals-feed", () => ({
  SignalsFeed: () => <div data-testid="signals-feed">Signals feed</div>,
}));
vi.mock("@/components/today/plan-adherence-cell", () => ({
  PlanAdherenceCell: () => <div data-testid="plan-adherence-cell" />,
}));
vi.mock("@/components/today/focus-today-cell", () => ({
  FocusTodayCell: () => <div data-testid="focus-today-cell" />,
}));
vi.mock("@/components/today/now-block", () => ({
  NowBlock: () => <div data-testid="now-block">Code implementation now</div>,
}));
vi.mock("@/components/today/focus-queue", () => ({
  FocusQueue: () => <div data-testid="focus-queue">Planner focus queue</div>,
}));
vi.mock("@/components/today/fixed-schedule", () => ({
  FixedSchedule: () => <div data-testid="fixed-schedule" />,
}));
vi.mock("@/components/today/plan-bar", () => ({
  PlanBar: () => <div data-testid="plan-bar">Planner mode</div>,
}));
vi.mock("@/components/today/no-plan-strip", () => ({
  NoPlanStrip: () => <div data-testid="no-plan-strip">Planner mode fallback</div>,
}));
vi.mock("@/components/today/today-skeleton", () => ({
  TodaySkeleton: () => <div data-testid="today-skeleton" />,
}));

beforeEach(() => {
  mockVitalsToday.data = {
    metrics,
    sleep,
    recent_activities: [],
  };
  mockVitalsToday.isLoading = false;
  healthFactoidsProps.length = 0;
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("Today page redesign", () => {
  it("renders the health-first Today composition", () => {
    wrap(<TodayPage />);

    expect(
      screen.getByRole("heading", { name: /^today$/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("today-health-factoids")).toBeInTheDocument();
    expect(screen.getByTestId("quick-add-today-action-form")).toBeInTheDocument();
    expect(screen.getByTestId("actions-today")).toBeInTheDocument();
  });

  it("does not render old planner, code implementation, Job Hunt, or reminders clutter", () => {
    wrap(<TodayPage />);

    expect(screen.queryByText(/planner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/code implementation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/job hunt/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("reminders-today")).not.toBeInTheDocument();
    expect(screen.queryByTestId("day-timeline")).not.toBeInTheDocument();
    expect(screen.queryByTestId("stats-grid")).not.toBeInTheDocument();
  });

  it("passes today's metrics and sleep into health factoids", () => {
    wrap(<TodayPage />);

    expect(healthFactoidsProps).toHaveLength(1);
    expect(healthFactoidsProps[0]).toMatchObject({
      metrics,
      sleep,
      isLoading: false,
    });
    expect(healthFactoidsProps[0]?.metrics?.hrv_weekly_avg).toBe(64);
    expect(healthFactoidsProps[0]?.metrics?.hrv_last_night_avg).toBe(68);
  });

  it("passes loading state to health factoids", () => {
    mockVitalsToday.data = null;
    mockVitalsToday.isLoading = true;

    wrap(<TodayPage />);

    expect(healthFactoidsProps[0]).toMatchObject({
      metrics: undefined,
      sleep: undefined,
      isLoading: true,
    });
  });
});
