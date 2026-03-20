import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { BriefingCard } from "@/components/vitals/briefing-card";
import { TodaySummary } from "@/components/vitals/today-summary";
import type { VitalsBriefing, VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

// --- Mock setup ---

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: {
      id: 99,
      email: "demo@example.com",
      display_name: "Demo User",
      role: "demo",
      must_change_password: false,
      is_blocked: false,
      theme: "dark",
      last_login_at: null,
    },
    isLoading: false,
    isDemo: true,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/vitals",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

// Mock all vitals hooks with connected data
const mockConnection = { connected: true, last_sync_at: "2026-03-20T10:00:00Z", sync_status: "completed", sync_error: null, sync_interval_minutes: 60, connected_at: "2026-03-01T00:00:00Z" };
const mockToday = {
  metrics: {
    id: 1, date: "2026-03-20", steps: 8432, distance_m: 6500,
    calories_active: 350, calories_total: 2200, floors_climbed: 12,
    intensity_minutes: 45, resting_hr: 62, avg_hr: 75, max_hr: 145,
    min_hr: 55, avg_stress: 32, max_stress: 67, body_battery_high: 87,
    body_battery_low: 32, vo2_max: 45.5,
  } satisfies VitalsDailyMetric,
  sleep: {
    id: 1, date: "2026-03-20", duration_seconds: 26580, deep_seconds: 5400,
    light_seconds: 12600, rem_seconds: 5400, awake_seconds: 3180,
    sleep_score: 78, start_time: "2026-03-19T23:00:00Z", end_time: "2026-03-20T06:23:00Z",
  } satisfies VitalsSleep,
  recent_activities: [],
};
const mockBriefing: VitalsBriefing = {
  id: 1, date: "2026-03-20",
  content: "## Health Status\nGood energy levels today.",
  generated_at: "2026-03-20T08:00:00Z",
};

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({ data: mockConnection, isLoading: false }),
  useVitalsToday: () => ({ data: mockToday, isLoading: false }),
  useVitalsBriefing: () => ({ data: mockBriefing, isLoading: false }),
  useVitalsActivities: () => ({ data: [], isLoading: false }),
  useVitalsMetrics: () => ({ data: [], isLoading: false }),
  useVitalsSleep: () => ({ data: [], isLoading: false }),
  useGenerateBriefing: () => ({ mutate: vi.fn(), isPending: false }),
  useSyncVitals: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock recharts to avoid canvas/SVG rendering issues in JSDOM
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  Line: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// --- Tests ---

describe("Vitals page — demo user sees disabled Sync button", () => {
  it("shows Demo Mode badge instead of Sync now button", async () => {
    const VitalsPage = (await import("@/app/(dashboard)/vitals/page")).default;
    render(<VitalsPage />, { wrapper: createWrapper() });

    // The Sync button should NOT be rendered for demo users
    expect(screen.queryByText("Sync now")).not.toBeInTheDocument();

    // Demo Mode badge should be visible (compact badge for Sync)
    const demoBadges = screen.getAllByText("Demo Mode");
    expect(demoBadges.length).toBeGreaterThanOrEqual(1);
  });
});

describe("BriefingCard — demo user sees disabled Regenerate button", () => {
  it("shows Demo Mode badge instead of Regenerate button when briefing exists", () => {
    render(
      <BriefingCard
        briefing={mockBriefing}
        isLoading={false}
        onGenerate={vi.fn()}
        isGenerating={false}
      />,
    );

    // Regenerate button should NOT be rendered for demo users
    expect(screen.queryByText("Regenerate")).not.toBeInTheDocument();

    // Demo Mode badge should be visible
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
  });

  it("shows Demo Mode badge instead of Generate Briefing button when no briefing", () => {
    render(
      <BriefingCard
        briefing={null}
        isLoading={false}
        onGenerate={vi.fn()}
        isGenerating={false}
      />,
    );

    // Generate Briefing button should NOT be rendered for demo users
    expect(screen.queryByText("Generate Briefing")).not.toBeInTheDocument();

    // Demo Mode badge should be visible
    expect(screen.getByText("Demo Mode")).toBeInTheDocument();
  });
});

describe("Vitals page — demo user sees vitals data", () => {
  it("renders KPI values and does NOT show the empty 'Connect Garmin' state", async () => {
    const VitalsPage = (await import("@/app/(dashboard)/vitals/page")).default;
    render(<VitalsPage />, { wrapper: createWrapper() });

    // Should NOT show the not-connected empty state
    expect(screen.queryByTestId("vitals-not-connected")).not.toBeInTheDocument();
    expect(screen.queryByText("Garmin not connected")).not.toBeInTheDocument();

    // Should render actual KPI values from mockToday.metrics
    expect(screen.getByText("8,432")).toBeInTheDocument();       // steps
    expect(screen.getByText("62 bpm")).toBeInTheDocument();      // resting HR
    expect(screen.getByText("7h 23m")).toBeInTheDocument();      // sleep duration
    expect(screen.getByText("32")).toBeInTheDocument();           // avg stress
    expect(screen.getByText("87 / 32")).toBeInTheDocument();     // body battery
  });

  it("renders the AI briefing content", async () => {
    const VitalsPage = (await import("@/app/(dashboard)/vitals/page")).default;
    render(<VitalsPage />, { wrapper: createWrapper() });

    // Briefing markdown should be rendered
    expect(screen.getByText("Health Status")).toBeInTheDocument();
    expect(screen.getByText(/Good energy levels/)).toBeInTheDocument();
  });
});

describe("TodaySummary — renders metrics regardless of demo mode", () => {
  it("displays all 5 KPI cards with values", () => {
    render(
      <TodaySummary
        metrics={mockToday.metrics}
        sleep={mockToday.sleep}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId("vitals-summary")).toBeInTheDocument();
    expect(screen.getByText("Steps")).toBeInTheDocument();
    expect(screen.getByText("Resting HR")).toBeInTheDocument();
    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("Avg Stress")).toBeInTheDocument();
    expect(screen.getByText("Body Battery")).toBeInTheDocument();

    expect(screen.getByText("8,432")).toBeInTheDocument();
    expect(screen.getByText("62 bpm")).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("87 / 32")).toBeInTheDocument();
  });
});
