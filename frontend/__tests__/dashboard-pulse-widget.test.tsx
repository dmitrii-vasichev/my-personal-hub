import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PulseDigestWidget } from "@/components/dashboard/pulse-digest-widget";

const mockSummary = {
  digests: [
    {
      id: 1,
      category: "news",
      content_preview: "Apple launched a new product today. EU updated AI policy.",
      message_count: 42,
      generated_at: "2026-03-16T12:00:00Z",
    },
    {
      id: 2,
      category: "jobs",
      content_preview: "Senior Python Developer at Revolut. Backend Engineer at Stripe.",
      message_count: 25,
      generated_at: "2026-03-16T12:00:00Z",
    },
  ],
  period_start: "2026-03-15T12:00:00Z",
  period_end: "2026-03-16T12:00:00Z",
};

let mockData: typeof mockSummary | null = mockSummary;
let mockLoading = false;

vi.mock("@/hooks/use-dashboard-pulse", () => ({
  useDashboardPulse: () => ({
    data: mockData,
    isLoading: mockLoading,
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("PulseDigestWidget", () => {
  it("renders category rows with content preview", () => {
    mockData = mockSummary;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByText("42 messages")).toBeInTheDocument();
    expect(screen.getByText("25 messages")).toBeInTheDocument();
    expect(
      screen.getByText("Apple launched a new product today. EU updated AI policy.")
    ).toBeInTheDocument();
  });

  it("renders period in header", () => {
    mockData = mockSummary;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    expect(screen.getByText(/Mar 15 – Mar 16/)).toBeInTheDocument();
  });

  it("renders empty state when no digests", () => {
    mockData = { digests: [], period_start: null, period_end: null };
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    expect(
      screen.getByText("No digests yet — configure sources to get started")
    ).toBeInTheDocument();
  });

  it("renders loading skeleton", () => {
    mockData = null;
    mockLoading = true;

    const { container } = render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("has link to /pulse page", () => {
    mockData = mockSummary;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    const viewAllLink = screen.getByText(/View all/);
    expect(viewAllLink.closest("a")).toHaveAttribute("href", "/pulse");
  });
});
