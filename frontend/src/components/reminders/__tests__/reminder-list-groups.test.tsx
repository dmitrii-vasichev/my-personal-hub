import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import type { Reminder } from "@/types/reminder";
import { ReminderList } from "../reminder-list";

// Stub the hook module so ReminderRow's mutation hooks don't try to hit the API.
vi.mock("@/hooks/use-reminders", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useReminders: () => ({ data: [], isLoading: false, error: null }),
    useCreateReminder: stub,
    useUpdateReminder: stub,
    useDeleteReminder: stub,
    useMarkDone: stub,
    useSnoozeReminder: stub,
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

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  const now = new Date().toISOString();
  return {
    id: 1,
    user_id: 1,
    title: "Pay rent",
    details: null,
    checklist: [],
    remind_at: now,
    status: "pending",
    snoozed_until: null,
    recurrence_rule: null,
    snooze_count: 0,
    notification_sent_count: 0,
    completed_at: null,
    is_floating: false,
    is_urgent: false,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("ReminderList group headers (brutalist)", () => {
  it("renders the Space Grotesk header label for 'Today' with a count pill", () => {
    const reminders: Reminder[] = [
      makeReminder({ id: 1, title: "Pay rent" }),
      makeReminder({ id: 2, title: "Call dentist", is_urgent: true }),
    ];
    wrap(
      <ReminderList
        reminders={reminders}
        isLoading={false}
        error={null}
      />,
    );
    const header = screen.getByRole("heading", { name: /today/i });
    expect(header.className).toMatch(/font-\[family-name:var\(--font-space-grotesk\)\]/);
    // Count pill = number of reminders in the group.
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders the accent bar glyph (▍) in the group header", () => {
    const reminders: Reminder[] = [
      makeReminder({ id: 3, title: "Check oven" }),
    ];
    wrap(
      <ReminderList
        reminders={reminders}
        isLoading={false}
        error={null}
      />,
    );
    // Accent bar glyph appears once per group header.
    expect(screen.getByText("▍")).toBeInTheDocument();
  });
});
