import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock the hooks
const mockUsePulseInbox = vi.fn();
const mockUseInboxAction = vi.fn();
const mockUseBulkInboxAction = vi.fn();

vi.mock("@/hooks/use-pulse-inbox", () => ({
  usePulseInbox: () => mockUsePulseInbox(),
  useInboxAction: () => mockUseInboxAction(),
  useBulkInboxAction: () => mockUseBulkInboxAction(),
  PULSE_INBOX_KEY: "pulse-inbox",
}));

import { InboxView } from "@/components/pulse/inbox-view";
import type { InboxItem } from "@/types/pulse-inbox";

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockItems: InboxItem[] = [
  {
    id: 1,
    text: "Great article about machine learning fundamentals and how they apply in real-world scenarios",
    sender_name: "TechBot",
    message_date: "2026-03-16T10:00:00Z",
    source_title: "ML Channel",
    source_id: 1,
    ai_classification: "article",
    ai_relevance: 0.92,
    status: "new",
    collected_at: "2026-03-16T10:00:00Z",
  },
  {
    id: 2,
    text: "Quick tip: use Python generators for memory-efficient data processing",
    sender_name: "PythonTips",
    message_date: "2026-03-16T11:00:00Z",
    source_title: "Python Tips",
    source_id: 2,
    ai_classification: "lifehack",
    ai_relevance: 0.85,
    status: "new",
    collected_at: "2026-03-16T11:00:00Z",
  },
  {
    id: 3,
    text: "New tool: Bun runtime now supports edge functions natively",
    sender_name: "JSNews",
    message_date: "2026-03-16T12:00:00Z",
    source_title: "JS Ecosystem",
    source_id: 3,
    ai_classification: "tool",
    ai_relevance: 0.78,
    status: "in_digest",
    collected_at: "2026-03-16T12:00:00Z",
  },
];

const mockMutate = vi.fn();
const defaultMutation = {
  mutate: mockMutate,
  isPending: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseInboxAction.mockReturnValue(defaultMutation);
  mockUseBulkInboxAction.mockReturnValue(defaultMutation);
});

describe("InboxView", () => {
  it("renders loading state", () => {
    mockUsePulseInbox.mockReturnValue({ data: undefined, isLoading: true });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByTestId("inbox-loading")).toBeInTheDocument();
  });

  it("renders empty state when no items", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByTestId("inbox-empty")).toBeInTheDocument();
    expect(screen.getByText("Inbox is empty")).toBeInTheDocument();
  });

  it("renders inbox items with classification badges", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByTestId("inbox-view")).toBeInTheDocument();
    const items = screen.getAllByTestId("inbox-item");
    expect(items).toHaveLength(3);

    // Classification badges
    expect(screen.getByText("Article")).toBeInTheDocument();
    expect(screen.getByText("Lifehack")).toBeInTheDocument();
    expect(screen.getByText("Tool")).toBeInTheDocument();
  });

  it("shows relevance scores", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("shows total item count", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("toggles select all", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    const selectAllBtn = screen.getByText("Select all");
    fireEvent.click(selectAllBtn);

    expect(screen.getByText("3 selected")).toBeInTheDocument();
    expect(screen.getByText("Deselect all")).toBeInTheDocument();
  });

  it("shows bulk action buttons when items selected", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    // Select all
    fireEvent.click(screen.getByText("Select all"));

    // Bulk action buttons should appear
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
  });

  it("shows source titles", () => {
    mockUsePulseInbox.mockReturnValue({
      data: { items: mockItems, total: 3 },
      isLoading: false,
    });

    render(
      <Wrapper>
        <InboxView />
      </Wrapper>
    );

    expect(screen.getByText("ML Channel")).toBeInTheDocument();
    expect(screen.getByText("Python Tips")).toBeInTheDocument();
    expect(screen.getByText("JS Ecosystem")).toBeInTheDocument();
  });
});

describe("InboxItem types", () => {
  it("InboxItem has correct structure", () => {
    const item: InboxItem = mockItems[0];
    expect(item.id).toBe(1);
    expect(item.ai_classification).toBe("article");
    expect(item.ai_relevance).toBe(0.92);
    expect(item.status).toBe("new");
  });
});
