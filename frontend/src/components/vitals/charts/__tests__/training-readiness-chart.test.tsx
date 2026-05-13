import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrainingReadinessChart } from "../training-readiness-chart";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: () => null,
}));

describe("TrainingReadinessChart", () => {
  it("renders the chart when data is present", () => {
    const data = [
      { date: "2026-05-11", value: 75, level: "READY", recovery: 8 },
      { date: "2026-05-12", value: 92, level: "READY", recovery: 4 },
    ];
    const { container } = render(
      <TrainingReadinessChart data={data} period="7d" isLoading={false} />,
    );
    // Chart is mounted (recharts mocked: a div tree is rendered, no "no data" message)
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText(/no data/i)).not.toBeInTheDocument();
  });

  it("renders an empty state when there is no data", () => {
    render(<TrainingReadinessChart data={[]} period="7d" isLoading={false} />);
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });

  it("renders an empty state when all values are null", () => {
    const data = [
      { date: "2026-05-11", value: null, level: null, recovery: null },
      { date: "2026-05-12", value: null, level: null, recovery: null },
    ];
    render(<TrainingReadinessChart data={data} period="7d" isLoading={false} />);
    expect(screen.getByText(/No data/i)).toBeInTheDocument();
  });

  it("shows a loading skeleton when isLoading is true", () => {
    const { container } = render(
      <TrainingReadinessChart data={[]} period="7d" isLoading={true} />,
    );
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });
});
