import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PulseDigestWidget } from "@/components/dashboard/pulse-digest-widget";

const mockDigest = {
  id: 1,
  user_id: 1,
  category: "news",
  content: "Digest content here",
  message_count: 15,
  generated_at: "2026-03-16T12:00:00Z",
  period_start: "2026-03-15T12:00:00Z",
  period_end: "2026-03-16T12:00:00Z",
};

let mockData: typeof mockDigest | null = mockDigest;
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
  it("renders with digest data", () => {
    mockData = mockDigest;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    expect(screen.getByText("Pulse")).toBeInTheDocument();
    expect(screen.getByText("15 messages in latest digest")).toBeInTheDocument();
  });

  it("renders empty state when no digest", () => {
    mockData = null;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    expect(screen.getByText("Pulse")).toBeInTheDocument();
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
    mockData = mockDigest;
    mockLoading = false;

    render(
      <Wrapper>
        <PulseDigestWidget />
      </Wrapper>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/pulse");
  });
});
