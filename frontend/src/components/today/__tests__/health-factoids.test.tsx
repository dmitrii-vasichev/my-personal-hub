import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodayHealthFactoids } from "../health-factoids";
import type { VitalsDailyMetric, VitalsSleep } from "@/types/vitals";

function metric(overrides: Partial<VitalsDailyMetric> = {}): VitalsDailyMetric {
  return {
    id: 1,
    date: "2026-05-15",
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
    hrv_last_night_avg: 52,
    hrv_weekly_avg: 55,
    hrv_status: "BALANCED",
    vo2_max: null,
    training_readiness: 82,
    training_readiness_level: "READY",
    training_readiness_recovery_hours: 6,
    training_readiness_feedback: "Productive training is possible.",
    ...overrides,
  };
}

function sleep(overrides: Partial<VitalsSleep> = {}): VitalsSleep {
  return {
    id: 1,
    date: "2026-05-15",
    duration_seconds: 26580,
    deep_seconds: null,
    light_seconds: null,
    rem_seconds: null,
    awake_seconds: null,
    sleep_score: 78,
    start_time: null,
    end_time: null,
    ...overrides,
  };
}

describe("TodayHealthFactoids", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders readiness, weekly HRV with last-night subtext, and sleep duration", () => {
    render(<TodayHealthFactoids metrics={metric()} sleep={sleep()} isLoading={false} />);

    expect(screen.getByText("Training readiness")).toBeInTheDocument();
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(screen.getByText("READY - 6h recovery")).toBeInTheDocument();
    expect(screen.getByText("Training readiness").closest("div")).toHaveAttribute(
      "title",
      "Productive training is possible.",
    );

    const hrvTile = screen.getByText("HRV").closest("div");
    expect(hrvTile).not.toBeNull();
    expect(within(hrvTile!).getByText("55 ms")).toBeInTheDocument();
    expect(within(hrvTile!).getByText("Last night 52 ms - BALANCED")).toBeInTheDocument();

    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText("Score 78")).toBeInTheDocument();
  });

  it("marks health data as fresh when Garmin data is from yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00"));

    render(<TodayHealthFactoids metrics={metric()} sleep={sleep()} isLoading={false} />);

    const freshness = screen.getByTestId("today-health-freshness");
    expect(freshness).toHaveAttribute("data-status", "fresh");
    expect(freshness).toHaveAccessibleName("Vitals data is fresh");
  });

  it("marks health data as stale when any available Garmin data is older than yesterday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-16T12:00:00"));

    render(
      <TodayHealthFactoids
        metrics={metric({ date: "2026-05-14" })}
        sleep={sleep()}
        isLoading={false}
      />,
    );

    const freshness = screen.getByTestId("today-health-freshness");
    expect(freshness).toHaveAttribute("data-status", "stale");
    expect(freshness).toHaveAccessibleName("Vitals data may be stale");
  });

  it("does not replace missing weekly HRV with last-night HRV", () => {
    render(
      <TodayHealthFactoids
        metrics={metric({ hrv_weekly_avg: null, hrv_last_night_avg: 52 })}
        sleep={sleep()}
        isLoading={false}
      />,
    );

    const hrvTile = screen.getByText("HRV").closest("div");
    expect(within(hrvTile!).getByText("--")).toBeInTheDocument();
    expect(within(hrvTile!).getByText("Last night 52 ms - BALANCED")).toBeInTheDocument();
  });

  it("renders sleep fallback subtext when score is missing", () => {
    render(
      <TodayHealthFactoids
        metrics={metric()}
        sleep={sleep({ sleep_score: null })}
        isLoading={false}
      />,
    );

    expect(screen.getByText("Sleep")).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText("No sleep data")).toBeInTheDocument();
  });

  it("renders stable skeleton tiles while loading", () => {
    render(<TodayHealthFactoids metrics={null} sleep={null} isLoading />);
    const loading = screen.getByTestId("today-health-loading");
    expect(loading).toBeInTheDocument();
    expect(loading.children).toHaveLength(3);
    expect(screen.getByTestId("today-health-freshness")).toHaveAttribute("data-status", "missing");
  });
});
