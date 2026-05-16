import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Action } from "@/types/action";
import { ActionsTabs } from "../actions-tabs";

const mocks = vi.hoisted(() => ({
  pathname: "/actions",
  actions: [] as Action[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("@/hooks/use-actions", () => ({
  useActions: () => ({ data: mocks.actions, isLoading: false, error: null }),
}));

describe("ActionsTabs", () => {
  it("shows actions, inbox count, and birthdays in order", () => {
    mocks.actions = [
      makeAction({ id: 1, title: "Dated", action_date: "2026-05-02" }),
      makeAction({ id: 2, title: "Inbox one", action_date: null, remind_at: null }),
      makeAction({ id: 3, title: "Done inbox", action_date: null, remind_at: null, status: "done" }),
      makeAction({ id: 4, title: "Inbox two", action_date: null, remind_at: null }),
    ];

    render(<ActionsTabs />);

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Actions",
      "Inbox (2)",
      "Birthdays",
    ]);
    expect(tabs[1]).toHaveAttribute("href", "/actions/inbox");
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
