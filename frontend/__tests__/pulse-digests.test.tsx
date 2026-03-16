import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CategoryTabs } from "@/components/pulse/category-tabs";
import { DigestView, DigestEmptyState, DigestViewSkeleton } from "@/components/pulse/digest-view";
import type { PulseDigest } from "@/types/pulse-digest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockDigest: PulseDigest = {
  id: 1,
  user_id: 1,
  category: "news",
  content: "# News Digest\n\n## Tech\n\n- AI advances continue\n- New React release",
  message_count: 15,
  generated_at: "2026-03-16T09:00:00Z",
  period_start: "2026-03-15T00:00:00Z",
  period_end: "2026-03-16T00:00:00Z",
};

describe("CategoryTabs", () => {
  it("renders all category tabs", () => {
    const onChange = vi.fn();
    render(<CategoryTabs active={null} onChange={onChange} />);

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("News")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByText("Learning")).toBeInTheDocument();
  });

  it("calls onChange when tab clicked", () => {
    const onChange = vi.fn();
    render(<CategoryTabs active={null} onChange={onChange} />);

    fireEvent.click(screen.getByText("Jobs"));
    expect(onChange).toHaveBeenCalledWith("jobs");
  });

  it("calls onChange with null for All tab", () => {
    const onChange = vi.fn();
    render(<CategoryTabs active="news" onChange={onChange} />);

    fireEvent.click(screen.getByText("All"));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("DigestView", () => {
  it("renders digest content as markdown", () => {
    render(<DigestView digest={mockDigest} />);

    expect(screen.getByTestId("digest-view")).toBeInTheDocument();
    expect(screen.getByText("News Digest")).toBeInTheDocument();
    expect(screen.getByText("15 messages")).toBeInTheDocument();
  });

  it("renders period dates", () => {
    render(<DigestView digest={mockDigest} />);

    const view = screen.getByTestId("digest-view");
    expect(view).toBeInTheDocument();
  });
});

describe("DigestEmptyState", () => {
  it("renders empty state message", () => {
    render(<DigestEmptyState />);

    expect(screen.getByTestId("digest-empty")).toBeInTheDocument();
    expect(screen.getByText("No digests yet")).toBeInTheDocument();
    expect(screen.getByText(/Generate Now/)).toBeInTheDocument();
  });
});

describe("DigestViewSkeleton", () => {
  it("renders loading spinner", () => {
    render(<DigestViewSkeleton />);

    expect(screen.getByTestId("digest-loading")).toBeInTheDocument();
  });
});
