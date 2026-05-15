import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { QuickAddTodayActionForm } from "../quick-add-today-action-form";
import { withLocalTzOffset } from "../today-action-utils";

const mocks = vi.hoisted(() => ({
  createActionMutate: vi.fn(),
  isPending: false,
}));

vi.mock("@/hooks/use-actions", () => ({
  useCreateAction: () => ({
    mutate: mocks.createActionMutate,
    isPending: mocks.isPending,
  }),
}));

function renderForm() {
  return render(<QuickAddTodayActionForm />);
}

describe("QuickAddTodayActionForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));
    mocks.isPending = false;
    mocks.createActionMutate.mockReset();
    mocks.createActionMutate.mockImplementation((_payload, options) => {
      options?.onSuccess?.();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not submit an empty title", () => {
    renderForm();

    const submit = screen.getByRole("button", { name: /^add$/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("What needs to happen today?"), {
      target: { value: "   " },
    });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(mocks.createActionMutate).not.toHaveBeenCalled();
  });

  it("creates a today action without remind_at by default", () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("What needs to happen today?"), {
      target: { value: "Send invoice" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Send invoice",
        action_date: "2026-05-15",
        remind_at: undefined,
      }),
      expect.any(Object)
    );
  });

  it("defaults time to 09:00 and submits remind_at when time is enabled", () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("What needs to happen today?"), {
      target: { value: "Plan day" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add time/i }));

    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plan day",
        action_date: "2026-05-15",
        remind_at: withLocalTzOffset("2026-05-15", "09:00"),
      }),
      expect.any(Object)
    );
  });

  it("sets is_urgent when urgent is toggled", () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("What needs to happen today?"), {
      target: { value: "Call recruiter" },
    });
    fireEvent.click(screen.getByRole("button", { name: /mark as urgent/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Call recruiter",
        is_urgent: true,
      }),
      expect.any(Object)
    );
  });

  it("resets after a successful create", () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText("What needs to happen today?"), {
      target: { value: "Follow up" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add time/i }));
    fireEvent.click(screen.getByRole("button", { name: /mark as urgent/i }));
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    expect(screen.getByPlaceholderText("What needs to happen today?")).toHaveValue("");
    expect(screen.queryByDisplayValue("09:00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark as urgent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^add$/i })).toBeDisabled();
  });
});
