import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VitalsWidget } from "@/components/dashboard/vitals-widget";
import type { VitalsDashboardSummary } from "@/types/vitals";

const mockMetrics = {
  id: 1,
  date: "2026-03-20",
  steps: 8500,
  distance_m: 6200,
  calories_active: 340,
  calories_total: 2100,
  floors_climbed: 10,
  intensity_minutes: 40,
  resting_hr: 64,
  avg_hr: 72,
  max_hr: 140,
  min_hr: 52,
  avg_stress: 28,
  max_stress: 60,
  body_battery_high: 82,
  body_battery_low: 35,
  vo2_max: 44.0,
};

const mockSleep = {
  id: 1,
  date: "2026-03-20",
  duration_seconds: 25920, // 7h 12m → 7.2h
  deep_seconds: 5000,
  light_seconds: 12000,
  rem_seconds: 5000,
  awake_seconds: 3920,
  sleep_score: 75,
  start_time: "2026-03-19T23:00:00Z",
  end_time: "2026-03-20T06:12:00Z",
};

const mockFullData: VitalsDashboardSummary = {
  metrics: mockMetrics,
  sleep: mockSleep,
  connected: true,
  last_sync_at: "2026-03-20T08:00:00Z",
  sync_interval_minutes: 240,
  briefing_insight: null,
  metrics_7d: [mockMetrics],
  sleep_7d: [mockSleep],
};

let mockData: VitalsDashboardSummary | null = mockFullData;
let mockLoading = false;

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsDashboardSummary: () => ({
    data: mockData,
    isLoading: mockLoading,
  }),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isDemo: false }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("VitalsWidget", () => {
  beforeEach(() => {
    mockData = mockFullData;
    mockLoading = false;
  });

  it("renders loading skeleton", () => {
    mockData = null;
    mockLoading = true;

    const { container } = render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders connected state with all KPIs", () => {
    mockData = mockFullData;
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    // Steps: 8,500
    expect(screen.getByText("8,500")).toBeInTheDocument();
    // Resting HR: 64
    expect(screen.getByText("64")).toBeInTheDocument();
    // Sleep: 25920s = 7h 12m → 7.2h
    expect(screen.getByText("7.2h")).toBeInTheDocument();
    // Body Battery high: 82
    expect(screen.getByText("82")).toBeInTheDocument();
    // Avg Stress: 28
    expect(screen.getByText("28")).toBeInTheDocument();
  });

  it("renders not-connected state", () => {
    mockData = { metrics: null, sleep: null, connected: false, last_sync_at: null, sync_interval_minutes: null, briefing_insight: null, metrics_7d: [], sleep_7d: [] };
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    expect(
      screen.getByText("Connect Garmin in Settings")
    ).toBeInTheDocument();
  });

  it("renders 'View details' link pointing to /vitals", () => {
    mockData = mockFullData;
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    const viewLink = screen.getByText(/View details/);
    expect(viewLink.closest("a")).toHaveAttribute("href", "/vitals");
  });

  it("handles null metric values gracefully", () => {
    mockData = {
      metrics: {
        id: 1,
        date: "2026-03-20",
        steps: null,
        distance_m: null,
        calories_active: null,
        calories_total: null,
        floors_climbed: null,
        intensity_minutes: null,
        resting_hr: null,
        avg_hr: null,
        max_hr: null,
        min_hr: null,
        avg_stress: null,
        max_stress: null,
        body_battery_high: null,
        body_battery_low: null,
        vo2_max: null,
      },
      sleep: {
        id: 1,
        date: "2026-03-20",
        duration_seconds: null,
        deep_seconds: null,
        light_seconds: null,
        rem_seconds: null,
        awake_seconds: null,
        sleep_score: null,
        start_time: null,
        end_time: null,
      },
      connected: true,
      last_sync_at: "2026-03-20T08:00:00Z",
      sync_interval_minutes: null,
      briefing_insight: null,
      metrics_7d: [],
      sleep_7d: [],
    };
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    // Should show em-dash placeholders instead of crashing
    const dashes = screen.getAllByText("\u2014");
    expect(dashes.length).toBeGreaterThanOrEqual(5);
  });

  it("shows stale indicator when last sync exceeds 2x interval", () => {
    // sync_interval_minutes = 240 (4h), last_sync 10h ago → stale
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    mockData = {
      ...mockFullData,
      last_sync_at: tenHoursAgo,
      sync_interval_minutes: 240,
    };
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    expect(screen.getByTestId("vitals-widget-stale")).toBeInTheDocument();
  });

  it("hides stale indicator when sync is fresh", () => {
    // last sync 1h ago, interval 4h → 1h < 8h → not stale
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    mockData = {
      ...mockFullData,
      last_sync_at: oneHourAgo,
      sync_interval_minutes: 240,
    };
    mockLoading = false;

    render(
      <Wrapper>
        <VitalsWidget />
      </Wrapper>
    );

    expect(screen.queryByTestId("vitals-widget-stale")).not.toBeInTheDocument();
  });
});
