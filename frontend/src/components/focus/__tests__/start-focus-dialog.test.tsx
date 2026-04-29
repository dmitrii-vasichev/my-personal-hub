import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { StartFocusDialog } from "../start-focus-dialog";

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

describe("StartFocusDialog", () => {
  it("renders the 3 preset buttons when open", () => {
    render(
      <StartFocusDialog
        open
        onOpenChange={() => {}}
        actionId={42}
        planItemId={null}
      />,
    );
    expect(screen.getByRole("button", { name: "25M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "50M" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90M" })).toBeInTheDocument();
  });

  it("clicking 25M fires mutateAsync with the right payload", async () => {
    render(
      <StartFocusDialog
        open
        onOpenChange={() => {}}
        actionId={42}
        planItemId={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "25M" }));
    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledTimes(1);
    });
    expect(mutateAsyncSpy).toHaveBeenCalledWith({
      action_id: 42,
      plan_item_id: null,
      planned_minutes: 25,
    });
  });

  it("passes plan_item_id when only planItemId is provided", async () => {
    render(
      <StartFocusDialog
        open
        onOpenChange={() => {}}
        planItemId={7}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "50M" }));
    await waitFor(() => {
      expect(mutateAsyncSpy).toHaveBeenCalledWith({
        action_id: null,
        plan_item_id: 7,
        planned_minutes: 50,
      });
    });
  });
});
