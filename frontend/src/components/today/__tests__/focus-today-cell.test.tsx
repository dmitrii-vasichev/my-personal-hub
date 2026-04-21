import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { FocusTodayCell } from "../focus-today-cell";
import type { FocusSessionTodayResponse } from "@/types/focus-session";

const { todayState } = vi.hoisted(() => ({
  todayState: {
    data: undefined as FocusSessionTodayResponse | undefined,
  },
}));

vi.mock("@/hooks/use-focus-session", () => ({
  useFocusSessionToday: () => todayState,
}));

beforeEach(() => {
  todayState.data = undefined;
});

describe("FocusTodayCell", () => {
  it("renders 0m when total_minutes is 0", () => {
    todayState.data = { total_minutes: 0, sessions: [], count: 0 };
    render(<FocusTodayCell />);
    expect(screen.getByText("Focus · today")).toBeInTheDocument();
    expect(screen.getByText("0m")).toBeInTheDocument();
  });

  it("renders 2h 15m when total_minutes is 135", () => {
    todayState.data = { total_minutes: 135, sessions: [], count: 0 };
    render(<FocusTodayCell />);
    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });

  it("renders 0m when data is undefined (query still loading)", () => {
    todayState.data = undefined;
    render(<FocusTodayCell />);
    expect(screen.getByText("0m")).toBeInTheDocument();
  });
});
