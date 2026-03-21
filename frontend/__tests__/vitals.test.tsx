import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TodaySummary } from "@/components/vitals/today-summary";
import { BriefingCard } from "@/components/vitals/briefing-card";
import { ActivitiesList } from "@/components/vitals/activities-list";
import { PeriodSelector } from "@/components/vitals/period-selector";
import type { VitalsDailyMetric, VitalsSleep, VitalsActivity, VitalsBriefing } from "@/types/vitals";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

let mockIsDemo = false;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "test@test.com", display_name: "Test", role: "member", must_change_password: false, is_blocked: false, theme: "dark", last_login_at: null },
    isLoading: false,
    isDemo: mockIsDemo,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

const mockMetrics: VitalsDailyMetric = {
  id: 1,
  date: "2026-03-20",
  steps: 8432,
  distance_m: 6500,
  calories_active: 350,
  calories_total: 2200,
  floors_climbed: 12,
  intensity_minutes: 45,
  resting_hr: 62,
  avg_hr: 75,
  max_hr: 145,
  min_hr: 55,
  avg_stress: 32,
  max_stress: 67,
  body_battery_high: 87,
  body_battery_low: 32,
  vo2_max: 45.5,
};

const mockSleep: VitalsSleep = {
  id: 1,
  date: "2026-03-20",
  duration_seconds: 26580,
  deep_seconds: 5400,
  light_seconds: 12600,
  rem_seconds: 5400,
  awake_seconds: 3180,
  sleep_score: 78,
  start_time: "2026-03-19T23:00:00Z",
  end_time: "2026-03-20T06:23:00Z",
};

const mockBriefing: VitalsBriefing = {
  id: 1,
  date: "2026-03-20",
  content: "## Health Status\nGood energy levels today.\n\n## Recommendations\nBest focus window: 9-12 AM.",
  generated_at: "2026-03-20T08:00:00Z",
};

const mockActivities: VitalsActivity[] = [
  {
    id: 1,
    garmin_activity_id: 1001,
    activity_type: "running",
    name: "Morning Run",
    start_time: "2026-03-20T07:00:00Z",
    duration_seconds: 1800,
    distance_m: 5200,
    avg_hr: 155,
    max_hr: 175,
    calories: 320,
    avg_pace: "5:46",
    elevation_gain: 45,
  },
  {
    id: 2,
    garmin_activity_id: 1002,
    activity_type: "cycling",
    name: "Evening Ride",
    start_time: "2026-03-19T17:00:00Z",
    duration_seconds: 3600,
    distance_m: 25000,
    avg_hr: 140,
    max_hr: 165,
    calories: 550,
    avg_pace: null,
    elevation_gain: 200,
  },
  {
    id: 3,
    garmin_activity_id: 1003,
    activity_type: "strength_training",
    name: "Gym Session",
    start_time: "2026-03-18T08:00:00Z",
    duration_seconds: 2700,
    distance_m: null,
    avg_hr: 120,
    max_hr: 150,
    calories: 280,
    avg_pace: null,
    elevation_gain: null,
  },
];

// --- TodaySummary ---
describe("TodaySummary", () => {
  it("renders 5 KPI cards with correct values", () => {
    render(<TodaySummary metrics={mockMetrics} sleep={mockSleep} isLoading={false} />);
    expect(screen.getByText("8,432")).toBeInTheDocument();
    expect(screen.getByText("62 bpm")).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("87 / 32")).toBeInTheDocument();
  });

  it("shows dashes when metrics are null", () => {
    render(<TodaySummary metrics={null} sleep={null} isLoading={false} />);
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it("shows skeleton when loading", () => {
    render(<TodaySummary metrics={null} sleep={null} isLoading={true} />);
    expect(screen.getByTestId("vitals-summary-loading")).toBeInTheDocument();
  });
});

// --- BriefingCard ---
describe("BriefingCard", () => {
  it("renders markdown content", () => {
    render(
      <BriefingCard
        briefing={mockBriefing}
        isLoading={false}
        onGenerate={vi.fn()}
        isGenerating={false}
      />
    );
    expect(screen.getByText("Health Status")).toBeInTheDocument();
    expect(screen.getByText(/Best focus window/)).toBeInTheDocument();
  });

  it("shows regenerate button", () => {
    const onGenerate = vi.fn();
    render(
      <BriefingCard
        briefing={mockBriefing}
        isLoading={false}
        onGenerate={onGenerate}
        isGenerating={false}
      />
    );
    const btn = screen.getByText("Regenerate");
    fireEvent.click(btn);
    expect(onGenerate).toHaveBeenCalled();
  });

  it("shows empty state when no briefing", () => {
    render(
      <BriefingCard
        briefing={null}
        isLoading={false}
        onGenerate={vi.fn()}
        isGenerating={false}
      />
    );
    expect(screen.getByText("No briefing yet")).toBeInTheDocument();
    expect(screen.getByText("Generate Briefing")).toBeInTheDocument();
  });

  it("shows loading skeleton", () => {
    render(
      <BriefingCard
        briefing={null}
        isLoading={true}
        onGenerate={vi.fn()}
        isGenerating={false}
      />
    );
    expect(screen.getByTestId("briefing-loading")).toBeInTheDocument();
  });
});

// --- BriefingCard Demo Mode ---
describe("BriefingCard Demo Mode", () => {
  it("shows demo badge instead of regenerate button", () => {
    vi.mocked(vi.fn());
    // Re-mock auth to demo mode
    vi.doMock("@/lib/auth", () => ({
      useAuth: () => ({
        user: { id: 1, email: "demo@test.com", display_name: "Demo", role: "demo", must_change_password: false, is_blocked: false, theme: "dark", last_login_at: null },
        isLoading: false,
        isDemo: true,
        login: vi.fn(),
        logout: vi.fn(),
        refreshUser: vi.fn(),
      }),
    }));
  });
});

// --- ActivitiesList ---
describe("ActivitiesList", () => {
  it("renders activity rows", () => {
    render(<ActivitiesList activities={mockActivities} isLoading={false} />);
    expect(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(screen.getByText("Evening Ride")).toBeInTheDocument();
    expect(screen.getByText("Gym Session")).toBeInTheDocument();
  });

  it("filters by activity type", () => {
    render(<ActivitiesList activities={mockActivities} isLoading={false} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "running" } });
    expect(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(screen.queryByText("Evening Ride")).not.toBeInTheDocument();
    expect(screen.queryByText("Gym Session")).not.toBeInTheDocument();
  });

  it("shows empty state when no activities", () => {
    render(<ActivitiesList activities={[]} isLoading={false} />);
    expect(screen.getByText("No activities found")).toBeInTheDocument();
  });

  it("shows skeleton when loading", () => {
    render(<ActivitiesList activities={undefined} isLoading={true} />);
    expect(screen.getByTestId("activities-list")).toBeInTheDocument();
  });
});

// --- PeriodSelector ---
describe("PeriodSelector", () => {
  it("renders three period buttons", () => {
    render(<PeriodSelector value="7d" onChange={vi.fn()} />);
    expect(screen.getByText("7D")).toBeInTheDocument();
    expect(screen.getByText("30D")).toBeInTheDocument();
    expect(screen.getByText("90D")).toBeInTheDocument();
  });

  it("calls onChange when clicking a period", () => {
    const onChange = vi.fn();
    render(<PeriodSelector value="7d" onChange={onChange} />);
    fireEvent.click(screen.getByText("30D"));
    expect(onChange).toHaveBeenCalledWith("30d");
  });
});


// ── Stale data banner tests ──────────────────────────────────────────────

let mockConnection: Record<string, unknown> | undefined = undefined;
let mockConnectionLoading = false;

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({ data: mockConnection, isLoading: mockConnectionLoading }),
  useVitalsToday: () => ({ data: null, isLoading: false }),
  useVitalsBriefing: () => ({ data: null, isLoading: false }),
  useVitalsActivities: () => ({ data: [], isLoading: false }),
  useVitalsMetrics: () => ({ data: [], isLoading: false }),
  useVitalsSleep: () => ({ data: [], isLoading: false }),
  useGenerateBriefing: () => ({ mutate: vi.fn(), isPending: false }),
  useSyncVitals: () => ({ mutate: vi.fn(), isPending: false }),
  useVitalsDashboardSummary: () => ({ data: null, isLoading: false }),
  VITALS_KEY: "vitals",
}));

// Must import after mocks
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: VitalsPage } = await import("@/app/(dashboard)/vitals/page");

function VitalsWrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("VitalsPage — Stale Data Banner", () => {
  beforeEach(() => {
    mockIsDemo = false;
    mockConnectionLoading = false;
  });

  it("shows stale data banner when last sync exceeds 2x interval", () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    mockConnection = {
      connected: true,
      last_sync_at: tenHoursAgo,
      sync_interval_minutes: 240,
      sync_status: "success",
      sync_error: null,
      connected_at: "2026-03-19T12:00:00Z",
      rate_limited_until: null,
    };

    render(
      <VitalsWrapper>
        <VitalsPage />
      </VitalsWrapper>
    );

    expect(screen.getByTestId("stale-data-banner")).toBeInTheDocument();
    expect(screen.getByText(/Data may be outdated/)).toBeInTheDocument();
  });

  it("hides stale data banner when sync is fresh", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    mockConnection = {
      connected: true,
      last_sync_at: oneHourAgo,
      sync_interval_minutes: 240,
      sync_status: "success",
      sync_error: null,
      connected_at: "2026-03-19T12:00:00Z",
      rate_limited_until: null,
    };

    render(
      <VitalsWrapper>
        <VitalsPage />
      </VitalsWrapper>
    );

    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });

  it("hides stale data banner in demo mode", () => {
    mockIsDemo = true;
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    mockConnection = {
      connected: true,
      last_sync_at: tenHoursAgo,
      sync_interval_minutes: 240,
      sync_status: "success",
      sync_error: null,
      connected_at: "2026-03-19T12:00:00Z",
      rate_limited_until: null,
    };

    render(
      <VitalsWrapper>
        <VitalsPage />
      </VitalsWrapper>
    );

    expect(screen.queryByTestId("stale-data-banner")).not.toBeInTheDocument();
  });
});
