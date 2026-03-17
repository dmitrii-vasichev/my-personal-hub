import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SourcesList } from "@/components/pulse/sources-list";
import type { PulseSource } from "@/types/pulse-source";

const mockUpdateSource = vi.fn().mockResolvedValue({});
const mockDeleteSource = vi.fn().mockResolvedValue(undefined);

function makeMockSource(overrides: Partial<PulseSource> = {}): PulseSource {
  return {
    id: 1,
    user_id: 1,
    telegram_id: -1001234567890,
    username: "test_channel",
    title: "Test Channel",
    category: "news",
    subcategory: null,
    keywords: null,
    criteria: null,
    is_active: true,
    last_polled_at: null,
    poll_status: "idle",
    last_poll_error: null,
    last_poll_message_count: 0,
    created_at: "2026-03-16T12:00:00Z",
    ...overrides,
  };
}

let currentMockSources: PulseSource[] = [];

vi.mock("@/hooks/use-pulse-sources", () => ({
  usePulseSources: () => ({ data: currentMockSources, isLoading: false }),
  useUpdatePulseSource: () => ({
    mutateAsync: mockUpdateSource,
    isPending: false,
  }),
  useDeletePulseSource: () => ({
    mutateAsync: mockDeleteSource,
    isPending: false,
  }),
  PULSE_SOURCES_KEY: "pulse-sources",
  POLL_STATUS_KEY: "poll-status",
  usePollStatus: () => ({
    startPolling: vi.fn(),
    stopPolling: vi.fn(),
    data: null,
    isPolling: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("SourcesList — polling indicators", () => {
  const onAddClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Polling...' indicator when source is polling", () => {
    currentMockSources = [makeMockSource({ poll_status: "polling" })];

    render(
      <Wrapper>
        <SourcesList onAddClick={onAddClick} />
      </Wrapper>
    );

    expect(screen.getByText("Polling...")).toBeInTheDocument();
  });

  it("shows 'Error' indicator when source has error status", () => {
    currentMockSources = [
      makeMockSource({
        poll_status: "error",
        last_poll_error: "Connection timeout",
      }),
    ];

    render(
      <Wrapper>
        <SourcesList onAddClick={onAddClick} />
      </Wrapper>
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("shows 'Never' when source has never been polled", () => {
    currentMockSources = [makeMockSource({ last_polled_at: null })];

    render(
      <Wrapper>
        <SourcesList onAddClick={onAddClick} />
      </Wrapper>
    );

    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("shows time ago and message count when source was polled", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    currentMockSources = [
      makeMockSource({
        last_polled_at: fiveMinAgo,
        poll_status: "idle",
        last_poll_message_count: 7,
      }),
    ];

    render(
      <Wrapper>
        <SourcesList onAddClick={onAddClick} />
      </Wrapper>
    );

    expect(screen.getByText(/ago/)).toBeInTheDocument();
    expect(screen.getByText(/7 new/)).toBeInTheDocument();
  });

  it("does not show message count when zero", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    currentMockSources = [
      makeMockSource({
        last_polled_at: fiveMinAgo,
        poll_status: "idle",
        last_poll_message_count: 0,
      }),
    ];

    render(
      <Wrapper>
        <SourcesList onAddClick={onAddClick} />
      </Wrapper>
    );

    expect(screen.getByText(/ago/)).toBeInTheDocument();
    expect(screen.queryByText(/new/)).not.toBeInTheDocument();
  });
});
