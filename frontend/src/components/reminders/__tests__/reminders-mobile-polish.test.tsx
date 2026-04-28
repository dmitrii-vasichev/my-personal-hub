import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Reminder } from "@/types/reminder";
import { QuickAddForm } from "../quick-add-form";
import { ReminderList } from "../reminder-list";
import RemindersPage from "@/app/(dashboard)/reminders/page";

const mocks = vi.hoisted(() => ({
  markDoneMutate: vi.fn(),
  createReminderMutate: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/reminders",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-reminders", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useReminders: () => ({ data: [], isLoading: false, error: null }),
    useCompletedReminders: () => ({ data: [], isLoading: false }),
    useCreateReminder: () => ({
      mutate: mocks.createReminderMutate,
      isPending: false,
    }),
    useUpdateReminder: stub,
    useDeleteReminder: stub,
    useMarkDone: () => ({
      mutate: mocks.markDoneMutate,
      isPending: false,
    }),
    useRestoreReminder: stub,
    useSnoozeReminder: stub,
  };
});

vi.mock("@/hooks/use-birthdays", () => ({
  useBirthdays: () => ({ data: [], isLoading: false, error: null }),
}));

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
    title: "401 счет и 172$ - доделать важную финансовую штуку",
    remind_at: now,
    status: "pending",
    snoozed_until: null,
    recurrence_rule: "daily",
    snooze_count: 2,
    notification_sent_count: 0,
    task_id: null,
    task_title: null,
    completed_at: null,
    is_floating: false,
    is_urgent: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("Reminders mobile polish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render Quick Add in the Reminders page header", () => {
    wrap(<RemindersPage />);

    expect(screen.queryByText(/\+ Quick Add/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
  });

  it("uses a compact mobile page header while preserving desktop details", () => {
    wrap(<RemindersPage />);

    const eyebrow = screen.getByText("Module · Reminders");
    const heading = screen.getByRole("heading", { name: "REMINDERS_" });
    const stats = screen.getByText(/0 for today/i);
    const history = screen.getByRole("button", { name: /history/i });

    expect(eyebrow.className).toContain("hidden");
    expect(eyebrow.className).toContain("sm:block");
    expect(heading.className).toContain("text-[22px]");
    expect(heading.className).toContain("sm:text-[28px]");
    expect(stats.className).toContain("hidden");
    expect(stats.className).toContain("sm:block");
    expect(history.className).toContain("h-8");
    expect(history.className).toContain("sm:h-9");
  });

  it("removes Natural hint and keeps quick-add input at iOS-safe mobile size", () => {
    wrap(<QuickAddForm />);

    const input = screen.getByPlaceholderText("Remind me to…");
    expect(screen.queryByText(/natural/i)).not.toBeInTheDocument();
    expect(input.closest("form")?.className).toContain("p-1.5");
    expect(input.className).toContain("min-h-9");
    expect(input.className).toContain("text-[16px]");
  });

  it("removes row checkboxes and opens actions by tapping a reminder", async () => {
    const user = userEvent.setup();
    wrap(
      <ReminderList
        reminders={[makeReminder()]}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    await user.click(screen.getByText(/401 счет/));

    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("marks a reminder done from the expanded tap menu", async () => {
    const user = userEvent.setup();
    wrap(
      <ReminderList
        reminders={[makeReminder({ id: 42, title: "Разобраться с налогами" })]}
        isLoading={false}
        error={null}
      />,
    );

    await user.click(screen.getByText("Разобраться с налогами"));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(mocks.markDoneMutate).toHaveBeenCalledWith(42, expect.any(Object));
  });
});
