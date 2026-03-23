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
  it("renders content_preview as text for all categories", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 1,
          category: "news",
          content_preview: "EU AI Act enters enforcement phase",
          message_count: 20,
          items_count: null,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [
            { title: "Apple M4 Launch", classification: null },
          ],
        },
      ],
      period_start: "2026-03-20T00:00:00Z",
      period_end: "2026-03-21T00:00:00Z",
    };

    render(<PulseDigestWidget />, { wrapper });

    // Should show content_preview text, not preview_items badges
    expect(screen.getByText("EU AI Act enters enforcement phase")).toBeDefined();
    expect(screen.queryByText("Apple M4 Launch")).toBeNull();
  });

  it("shows items_count fallback when content_preview is empty", () => {
    mockPulseData.data = {
      digests: [
        {
          id: 4,
          category: "news",
          content_preview: "",
          message_count: 5,
          items_count: 7,
          generated_at: "2026-03-21T10:00:00Z",
          preview_items: [],
        },
      ],
      period_start: null,
      period_end: null,
    };

    render(<PulseDigestWidget />, { wrapper });

    expect(screen.getByText("7 new items to review")).toBeDefined();
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
