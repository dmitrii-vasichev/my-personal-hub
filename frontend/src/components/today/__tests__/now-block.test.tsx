import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NowBlock } from "../now-block";
import type { FocusSession } from "@/types/focus-session";

const { activeState, stopState } = vi.hoisted(() => ({
  activeState: {
    data: null as FocusSession | null,
  },
  stopState: {
    mutate: vi.fn(),
    isPending: false,
  },
}));

vi.mock("@/hooks/use-focus-session", () => ({
  useFocusSessionActive: () => activeState,
  useStopFocusMutation: () => stopState,
}));

function session(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id: 1,
    user_id: 1,
    action_id: 42,
    plan_item_id: null,
    // 1 minute ago — plenty of remaining time for a 25m session.
    started_at: new Date(Date.now() - 60_000).toISOString(),
    ended_at: null,
    planned_minutes: 25,
    auto_closed: false,
    actual_minutes: null,
    action_title: "Write PRD",
    plan_item_title: null,
    ...overrides,
  };
}

beforeEach(() => {
  activeState.data = null;
  stopState.mutate = vi.fn();
  stopState.isPending = false;
});

describe("NowBlock", () => {
  it("returns null when there is no active session", () => {
    activeState.data = null;
    const { container } = render(<NowBlock />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("NOW")).toBeNull();
  });

  it("renders NOW label, countdown, and action title when active", () => {
    activeState.data = session();
    render(<NowBlock />);
    expect(screen.getByText("NOW")).toBeInTheDocument();
    expect(screen.getByText(/Write PRD/)).toBeInTheDocument();
    // Countdown format is mm:ss / mm:ss
    expect(screen.getByText(/\d{2}:\d{2}\s*\/\s*25:00/)).toBeInTheDocument();
  });

  it("clicking STOP fires stop.mutate with the session id", () => {
    activeState.data = session({ id: 99 });
    render(<NowBlock />);
    const stopBtn = screen.getByRole("button", { name: /STOP/ });
    stopBtn.click();
    expect(stopState.mutate).toHaveBeenCalledWith(99);
  });

  it("auto-stop fires exactly once when remainingSec is already <= 0", () => {
    // Session started 26 minutes ago with a 25-minute plan → already elapsed.
    activeState.data = session({
      started_at: new Date(Date.now() - 26 * 60_000).toISOString(),
    });
    render(<NowBlock />);
    // Auto-stop effect should have fired on mount.
    expect(stopState.mutate).toHaveBeenCalledTimes(1);
    expect(stopState.mutate).toHaveBeenCalledWith(activeState.data!.id);
  });
});
