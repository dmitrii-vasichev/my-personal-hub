import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { StartFocusButton } from "../start-focus-button";

const { mutateAsyncSpy } = vi.hoisted(() => ({
  mutateAsyncSpy: vi.fn(),
}));

vi.mock("@/hooks/use-focus-session", () => ({
  useStartFocusMutation: () => ({
    mutateAsync: mutateAsyncSpy,
    isPending: false,
  }),
}));

beforeEach(() => {
  mutateAsyncSpy.mockReset();
  mutateAsyncSpy.mockResolvedValue({});
});

describe("StartFocusButton", () => {
  it("renders a button with the right aria-label and ▶ glyph", () => {
    render(<StartFocusButton taskId={1} />);
    const btn = screen.getByRole("button", { name: "Start focus session" });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("▶");
  });

  it("clicking the button opens the dialog (presets visible)", () => {
    render(<StartFocusButton taskId={1} />);
    // Before click, preset buttons should not be in the document.
    expect(screen.queryByRole("button", { name: "25M" })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Start focus session" }),
    );

    expect(screen.getByRole("button", { name: "25M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90M" })).toBeInTheDocument();
  });
});
