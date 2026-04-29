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
  updateReminderMutate: vi.fn(),
  replace: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
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
    useUpdateReminder: () => ({
      mutate: mocks.updateReminderMutate,
      isPending: false,
    }),
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
    details: null,
    checklist: [],
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

  it("redirects the legacy Reminders page to Actions", () => {
    RemindersPage();

    expect(mocks.redirect).toHaveBeenCalledWith("/actions");
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

  it("shows rich details with auto-linked URLs and toggles checklist items inline", async () => {
    const user = userEvent.setup();
    wrap(
      <ReminderList
        reminders={[
          makeReminder({
            id: 77,
            title: "Submit renewal",
            details: "Use https://example.com/renewal before sending.",
            checklist: [
              { id: "open-link", text: "Open renewal link", completed: false },
              { id: "send-form", text: "Send completed form", completed: true },
            ],
          }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    await user.click(screen.getByText("Submit renewal"));

    expect(screen.getByRole("link", { name: "https://example.com/renewal" })).toHaveAttribute(
      "href",
      "https://example.com/renewal",
    );
    expect(screen.getAllByText("1/2").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("checkbox", { name: "Open renewal link" }));

    expect(mocks.updateReminderMutate).toHaveBeenCalledWith(
      {
        id: 77,
        checklist: [
          { id: "open-link", text: "Open renewal link", completed: true },
          { id: "send-form", text: "Send completed form", completed: true },
        ],
      },
      expect.any(Object),
    );
  });

  it("saves details and a new checklist item from the edit dialog", async () => {
    const user = userEvent.setup();
    wrap(
      <ReminderList
        reminders={[
          makeReminder({
            id: 88,
            title: "Prepare instructions",
            details: "Old note",
            checklist: [{ id: "existing", text: "Existing step", completed: false }],
          }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    await user.click(screen.getByText("Prepare instructions"));
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const details = screen.getByLabelText("Reminder details");
    await user.clear(details);
    await user.type(details, "Updated note with https://example.com/reference");
    await user.type(screen.getByPlaceholderText("Add checklist item…"), "Confirm receipt{enter}");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(mocks.updateReminderMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 88,
        details: "Updated note with https://example.com/reference",
        checklist: expect.arrayContaining([
          { id: "existing", text: "Existing step", completed: false },
          expect.objectContaining({ text: "Confirm receipt", completed: false }),
        ]),
      }),
      expect.any(Object),
    );
  });
});
