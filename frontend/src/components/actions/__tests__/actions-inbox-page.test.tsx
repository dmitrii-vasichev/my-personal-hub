import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import InboxPage from "@/app/(dashboard)/actions/inbox/page";
import type { Action } from "@/types/action";

const mocks = vi.hoisted(() => ({
  actions: [] as Action[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/actions/inbox",
}));

vi.mock("@/hooks/use-actions", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActions: () => ({ data: mocks.actions, isLoading: false, error: null }),
    useCreateAction: stub,
    useUpdateAction: stub,
    useDeleteAction: stub,
    useMarkActionDone: stub,
    useSnoozeAction: stub,
  };
});

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

describe("Actions inbox page", () => {
  beforeEach(() => {
    mocks.actions = [];
  });

  it("shows only pending actions without a date or time", () => {
    mocks.actions = [
      makeAction({ id: 1, title: "Dated action", action_date: "2026-05-02" }),
      makeAction({ id: 2, title: "Inbox action", action_date: null, remind_at: null, mode: "inbox" }),
      makeAction({ id: 3, title: "Done inbox", action_date: null, remind_at: null, status: "done" }),
    ];

    wrap(<InboxPage />);

    expect(screen.getByRole("heading", { name: "INBOX_" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inbox action" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dated action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Done inbox" })).not.toBeInTheDocument();
  });
});

function makeAction(overrides: Partial<Action> = {}): Action {
  const now = new Date("2026-05-02T12:00:00Z").toISOString();
  return {
    id: 1,
    user_id: 1,
    title: "Pay rent",
    details: null,
    checklist: [],
    action_date: "2026-05-02",
    remind_at: null,
    mode: "anytime",
    status: "pending",
    snoozed_until: null,
    recurrence_rule: null,
    snooze_count: 0,
    notification_sent_count: 0,
    completed_at: null,
    is_floating: true,
    is_urgent: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}
