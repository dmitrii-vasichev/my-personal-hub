import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { FocusQueue } from "../focus-queue";
import type { DailyPlan } from "@/types/plan";

const { mutateSpy } = vi.hoisted(() => ({ mutateSpy: vi.fn() }));

vi.mock("@/hooks/use-plan-today", () => ({
  useCompleteItemMutation: () => ({ mutate: mutateSpy }),
  PLAN_TODAY_KEY: ["planner", "plans", "today"],
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function plan(): DailyPlan {
  return {
    id: 1,
    user_id: 1,
    date: "2026-04-20",
    available_minutes: 300,
    planned_minutes: 100,
    completed_minutes: 30,
    adherence_pct: null,
    replans_count: 0,
    categories_planned: {},
    categories_actual: {},
    items: [
      {
        id: 1,
        plan_id: 1,
        order: 1,
        title: "Buy tickets",
        category: "life",
        minutes_planned: 10,
        minutes_actual: 10,
        status: "done",
        linked_task_id: null,
        task_title: null,
        notes: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: 2,
        plan_id: 1,
        order: 2,
        title: "Cover letter Acme",
        category: "career",
        minutes_planned: 60,
        minutes_actual: null,
        status: "pending",
        linked_task_id: 42,
        task_title: "Cover letter",
        notes: null,
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => mutateSpy.mockClear());

describe("FocusQueue", () => {
  it("renders items with category + duration without task-link noise", () => {
    wrap(<FocusQueue plan={plan()} />);
    expect(screen.getByText("Cover letter Acme")).toBeInTheDocument();
    expect(screen.getByText("CAREER")).toBeInTheDocument();
    expect(screen.getByText("60m")).toBeInTheDocument();
    expect(screen.queryByText("#42")).toBeNull();
  });

  it("done rows render with .done modifier", () => {
    const { container } = wrap(<FocusQueue plan={plan()} />);
    const doneRow = container.querySelector('[data-status="done"]');
    expect(doneRow).not.toBeNull();
  });

  it("clicking unchecked row fires mutation with minutes_actual=minutes_planned", () => {
    wrap(<FocusQueue plan={plan()} />);
    const box = screen.getByRole("checkbox", { name: /Cover letter Acme/ });
    fireEvent.click(box);
    expect(mutateSpy).toHaveBeenCalledWith({
      id: 2,
      body: { status: "done", minutes_actual: 60 },
    });
  });

  it("clicking a done row does nothing", () => {
    wrap(<FocusQueue plan={plan()} />);
    const box = screen.getByRole("checkbox", { name: /Buy tickets/ });
    fireEvent.click(box);
    expect(mutateSpy).not.toHaveBeenCalled();
  });
});
