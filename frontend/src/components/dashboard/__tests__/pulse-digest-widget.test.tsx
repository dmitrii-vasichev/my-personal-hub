import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { PulseDigestWidget } from "../pulse-digest-widget";
import type { PulseSummaryResponse } from "@/types/pulse-digest";

// --- Mocks ---

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockPulseData: { data: PulseSummaryResponse | null; isLoading: boolean } =
  { data: null, isLoading: false };

vi.mock("@/hooks/use-dashboard-pulse", () => ({
  useDashboardPulse: () => mockPulseData,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockPulseData.data = null;
  mockPulseData.isLoading = false;
});

// --- Tests ---

describe("PulseDigestWidget", () => {
  it("renders item titles from preview_items", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 1,
          category: "news",
          content_preview: "Some preview text",
          message_count: 20,
          items_count: null,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [
            { title: "Apple M4 Launch", classification: null },
            { title: "EU AI Act Update", classification: null },
          ],
        },
      ],
      period_start: "2026-03-20T00:00:00Z",
      period_end: "2026-03-21T00:00:00Z",
    };

    render(<PulseDigestWidget />, { wrapper });

    expect(screen.getByText("Apple M4 Launch")).toBeDefined();
    expect(screen.getByText("EU AI Act Update")).toBeDefined();
  });

  it("shows classification badge for structured items", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 2,
          category: "learning",
          content_preview: "",
          message_count: 15,
          items_count: 8,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [
            { title: "Python Async Guide", classification: "tutorial" },
            { title: "FastAPI Tips", classification: "article" },
          ],
        },
      ],
      period_start: null,
      period_end: null,
    };

    render(<PulseDigestWidget />, { wrapper });

    expect(screen.getByText("Python Async Guide")).toBeDefined();
    expect(screen.getByText("tutorial")).toBeDefined();
    expect(screen.getByText("article")).toBeDefined();
  });

  it("shows '+N more' indicator when total exceeds displayed", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 3,
          category: "jobs",
          content_preview: "",
          message_count: 30,
          items_count: 12,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [
            { title: "Senior Dev at Revolut", classification: "job" },
            { title: "Staff Eng at Stripe", classification: "job" },
          ],
        },
      ],
      period_start: null,
      period_end: null,
    };

    render(<PulseDigestWidget />, { wrapper });

    // items_count=12, displayed=2 → + 10 more
    expect(screen.getByText("+ 10 more")).toBeDefined();
  });

  it("falls back to content_preview when preview_items is empty", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 4,
          category: "news",
          content_preview: "Fallback preview text here",
          message_count: 5,
          items_count: null,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [],
        },
      ],
      period_start: null,
      period_end: null,
    };

    render(<PulseDigestWidget />, { wrapper });

    expect(screen.getByText("Fallback preview text here")).toBeDefined();
  });

  it("renders empty state when no digests", () => {
    mockPulseData.data = {
      digests: [],
      period_start: null,
      period_end: null,
    };

    render(<PulseDigestWidget />, { wrapper });

    expect(
      screen.getByText("No digests yet — configure sources to get started")
    ).toBeDefined();
  });
});
