import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "@/types/action";
import { ActionsToday } from "../actions-today";

const { actionsState, markDoneMutate, mutationStub } = vi.hoisted(() => ({
  actionsState: {
    data: [] as Action[] | undefined,
    isLoading: false,
    error: null as Error | null,
  },
  markDoneMutate: vi.fn(),
  mutationStub: vi.fn(),
}));

vi.mock("@/hooks/use-actions", () => ({
  useActions: vi.fn((includeDone = false) => {
    if (includeDone !== false) {
      throw new Error("ActionsToday must fetch pending actions only");
    }
    return actionsState;
  }),
  useUpdateAction: () => ({
    mutate: mutationStub,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeleteAction: () => ({
    mutate: mutationStub,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useMarkActionDone: () => ({
    mutate: markDoneMutate,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSnoozeAction: () => ({
    mutate: mutationStub,
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/focus/start-focus-button", () => ({
  StartFocusButton: () => <button type="button">Start focus</button>,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    user_id: 1,
    title: "Today action",
    details: null,
    checklist: [],
    action_date: "2026-05-15",
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
    created_at: "2026-05-15T12:00:00Z",
    updated_at: "2026-05-15T12:00:00Z",
    ...overrides,
  };
}

function renderTitles() {
  return screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
  actionsState.data = [];
  actionsState.isLoading = false;
  actionsState.error = null;
  markDoneMutate.mockClear();
  mutationStub.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ActionsToday", () => {
  it("shows a compact loading state", () => {
    actionsState.isLoading = true;
    actionsState.data = undefined;

    const { container } = wrap(<ActionsToday />);

    expect(screen.getByText(/loading today's actions/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="actions-today-skeleton"]')).toHaveLength(3);
  });

  it("shows a compact empty state when no pending actions belong to today", () => {
    actionsState.data = [
      makeAction({ id: 1, title: "Tomorrow", action_date: "2026-05-16" }),
      makeAction({ id: 2, title: "Inbox", action_date: null, remind_at: null, mode: "inbox" }),
    ];

    wrap(<ActionsToday />);

    expect(screen.getByText(/no actions for today/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 4 })).not.toBeInTheDocument();
  });

  it("filters out non-today and done actions", () => {
    actionsState.data = [
      makeAction({ id: 1, title: "Today by date", action_date: "2026-05-15" }),
      makeAction({
        id: 2,
        title: "Today by reminder",
        action_date: null,
        remind_at: "2026-05-15T17:00:00-06:00",
      }),
      makeAction({ id: 3, title: "Tomorrow", action_date: "2026-05-16" }),
      makeAction({ id: 4, title: "Done today", status: "done" }),
    ];

    wrap(<ActionsToday />);

    expect(screen.getByRole("heading", { name: "Today by date", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Today by reminder", level: 4 })).toBeInTheDocument();
    expect(screen.queryByText("Tomorrow")).not.toBeInTheDocument();
    expect(screen.queryByText("Done today")).not.toBeInTheDocument();
  });

  it("sorts scheduled actions before unscheduled, then urgent and created order", () => {
    actionsState.data = [
      makeAction({
        id: 1,
        title: "Anytime normal",
        created_at: "2026-05-15T12:00:00Z",
      }),
      makeAction({
        id: 2,
        title: "Scheduled late",
        remind_at: "2026-05-15T18:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 3,
        title: "Scheduled early",
        remind_at: "2026-05-15T09:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 4,
        title: "Anytime urgent",
        is_urgent: true,
        created_at: "2026-05-15T13:00:00Z",
      }),
    ];

    wrap(<ActionsToday />);

    expect(renderTitles()).toEqual([
      "Scheduled early",
      "Scheduled late",
      "Anytime urgent",
      "Anytime normal",
    ]);
  });

  it("renders ActionRow without the Focus button", () => {
    actionsState.data = [makeAction({ id: 1, title: "No focus here" })];

    wrap(<ActionsToday />);
    fireEvent.click(screen.getByRole("heading", { name: "No focus here", level: 4 }));

    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    expect(screen.queryByText("Focus")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start focus/i })).not.toBeInTheDocument();
  });

  it("expands ActionRow details and edit affordances", () => {
    actionsState.data = [
      makeAction({
        id: 1,
        title: "Expandable action",
        details: "Bring the detailed notes",
      }),
    ];

    wrap(<ActionsToday />);
    const row = screen.getByRole("heading", { name: "Expandable action", level: 4 }).closest("article");
    fireEvent.click(within(row!).getByRole("heading", { name: "Expandable action", level: 4 }));

    expect(screen.getByText("Bring the detailed notes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("uses ActionRow's existing mark-done mutation path", () => {
    actionsState.data = [makeAction({ id: 42, title: "Finish task" })];

    wrap(<ActionsToday />);
    fireEvent.click(screen.getByRole("heading", { name: "Finish task", level: 4 }));
    fireEvent.click(screen.getByRole("button", { name: /done/i }));

    expect(markDoneMutate).toHaveBeenCalledWith(42, expect.any(Object));
  });
});
