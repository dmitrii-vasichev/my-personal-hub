import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlanBar } from "../plan-bar";
import type { DailyPlan } from "@/types/plan";

function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
  return {
    id: 1,
    user_id: 1,
    date: "2026-04-20",
    available_minutes: 300,
    planned_minutes: 280,
    completed_minutes: 85,
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
        title: "English SRS",
        category: "language",
        minutes_planned: 30,
        minutes_actual: null,
        status: "pending",
        linked_task_id: null,
        task_title: null,
        notes: null,
        created_at: "",
        updated_at: "",
      },
    ],
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("PlanBar", () => {
  it("renders progress counts and NEXT pointer", () => {
    render(<PlanBar plan={makePlan()} />);
    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
    expect(screen.getByText(/85\s*\/\s*280/)).toBeInTheDocument();
    expect(screen.getByText(/English SRS/)).toBeInTheDocument();
    expect(screen.getByText(/30m/)).toBeInTheDocument();
  });

  it("shows 'all complete' when every item is done or skipped", () => {
    const p = makePlan();
    p.items = p.items.map((i) => ({ ...i, status: "done" as const }));
    render(<PlanBar plan={p} />);
    expect(screen.getByText(/all items complete/i)).toBeInTheDocument();
  });
});
