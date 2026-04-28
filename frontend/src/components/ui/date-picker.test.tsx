import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

describe("DatePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 3, 28, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function openPicker(value = "", onChange = vi.fn()) {
    const user = userEvent.setup();
    render(
      <DatePicker
        value={value}
        onChange={onChange}
        placeholder="Pick date"
      />,
    );

    await user.click(screen.getByRole("button"));

    return { user, onChange };
  }

  it("preselects today's date when opened without a value", async () => {
    await openPicker();

    const grid = screen.getByRole("grid", { name: /april 2026/i });
    const today = within(grid).getByRole("gridcell", { name: /28/i });

    expect(today).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the provided value selected instead of defaulting to today", async () => {
    await openPicker("2026-04-15");

    const grid = screen.getByRole("grid", { name: /april 2026/i });
    const selectedDay = within(grid).getByRole("gridcell", { name: /15/i });
    const today = within(grid).getByRole("gridcell", { name: /28/i });

    expect(selectedDay).toHaveAttribute("aria-selected", "true");
    expect(today).not.toHaveAttribute("aria-selected", "true");
  });

  it("selects today's date when the preselected day is clicked", async () => {
    const onChange = vi.fn();
    const { user } = await openPicker("", onChange);

    const grid = screen.getByRole("grid", { name: /april 2026/i });
    const today = within(grid).getByRole("gridcell", { name: /28/i });

    await user.click(within(today).getByRole("button"));

    expect(onChange).toHaveBeenCalledWith("2026-04-28");
  });
});
