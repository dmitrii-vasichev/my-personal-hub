import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import type { Action } from "@/types/action";
import type { ChecklistItem } from "@/types/checklist";
import { ActionList } from "../action-list";

vi.mock("@/hooks/use-actions", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
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

function makeChecklist(completed: number, total: number): ChecklistItem[] {
  return Array.from({ length: total }, (_, index) => ({
    id: `item-${index + 1}`,
    text: `Step ${index + 1}`,
    completed: index < completed,
  }));
}

describe("ActionList grouping", () => {
  it("groups overdue, today, future dates, and inbox", () => {
    wrap(
      <ActionList
        actions={[
          makeAction({ id: 1, title: "Old item", action_date: "2026-05-01" }),
          makeAction({ id: 2, title: "Today item", action_date: "2026-05-02" }),
          makeAction({ id: 3, title: "Future", action_date: "2026-05-05" }),
          makeAction({ id: 4, title: "Inbox", action_date: null, mode: "inbox" }),
        ]}
        today={new Date("2026-05-02T09:00:00Z")}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByRole("heading", { name: /overdue/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^today$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /may 5, 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /inbox\/someday/i })).toBeInTheDocument();
  });

  it("sorts scheduled before anytime and urgent only within anytime", () => {
    wrap(
      <ActionList
        actions={[
          makeAction({ id: 1, title: "Anytime urgent", is_urgent: true }),
          makeAction({
            id: 2,
            title: "Scheduled late",
            remind_at: "2026-05-02T18:00:00Z",
            mode: "scheduled",
            is_floating: false,
          }),
          makeAction({
            id: 3,
            title: "Scheduled early",
            remind_at: "2026-05-02T09:00:00Z",
            mode: "scheduled",
            is_floating: false,
          }),
          makeAction({ id: 4, title: "Anytime normal" }),
        ]}
        today={new Date("2026-05-02T09:00:00Z")}
        isLoading={false}
        error={null}
      />,
    );

    const todaySection = screen.getByRole("heading", { name: /^today$/i }).closest("section");
    const titles = within(todaySection!).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Scheduled early",
      "Scheduled late",
      "Anytime urgent",
      "Anytime normal",
    ]);
  });

  it("shows mobile icon chips for urgent recurring snoozed checklist actions", () => {
    wrap(
      <ActionList
        actions={[
          makeAction({
            title: "Long mobile action with important metadata",
            is_urgent: true,
            recurrence_rule: "daily",
            snooze_count: 6,
            checklist: makeChecklist(0, 2),
          }),
        ]}
        today={new Date("2026-05-02T09:00:00Z")}
        isLoading={false}
        error={null}
      />,
    );

    const row = screen
      .getByRole("heading", { name: "Long mobile action with important metadata" })
      .closest("article");

    expect(within(row!).getByLabelText("Urgent action")).toBeInTheDocument();
    expect(within(row!).getByLabelText("Repeats Daily")).toBeInTheDocument();
    expect(within(row!).getByLabelText("Snoozed 6 times")).toBeInTheDocument();
    expect(within(row!).getByLabelText("Checklist 0 of 2")).toBeInTheDocument();
  });
});
