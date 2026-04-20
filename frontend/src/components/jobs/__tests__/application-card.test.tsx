import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { ApplicationCard } from "../application-card";
import type { ApplicationStatus, KanbanCard } from "@/types/job";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function wrap(ui: React.ReactElement) {
  return render(<DndContext>{ui}</DndContext>);
}

function makeCard(overrides: Partial<KanbanCard> = {}): KanbanCard {
  return {
    id: 1,
    status: "applied" as ApplicationStatus,
    title: "Senior Engineer",
    company: "Acme Corp",
    location: undefined,
    match_score: undefined,
    applied_date: undefined,
    next_action: undefined,
    next_action_date: undefined,
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    ...overrides,
  };
}

describe("ApplicationCard", () => {
  beforeEach(() => {
    // Fixed "today" = 2026-04-20 so daysSince math is deterministic
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("hot variant: status=screening + next_action_date 2 days away → orange border", () => {
    const card = makeCard({
      status: "screening",
      next_action_date: "2026-04-22",
    });
    wrap(<ApplicationCard card={card} />);
    const el = screen.getByTestId("application-card-1");
    expect(el.className).toContain("border-[color:var(--accent-2)]");
  });

  it("offer variant: status=offer → teal border", () => {
    const card = makeCard({ id: 2, status: "offer" });
    wrap(<ApplicationCard card={card} />);
    const el = screen.getByTestId("application-card-2");
    expect(el.className).toContain("border-[color:var(--accent-3)]");
  });

  it("renders applied_date footer in '10 APR · 10D' form", () => {
    const card = makeCard({
      id: 3,
      status: "applied",
      applied_date: "2026-04-10",
    });
    wrap(<ApplicationCard card={card} />);
    // 2026-04-20 minus 2026-04-10 = 10 days
    expect(screen.getByText(/10 APR · 10D/)).toBeInTheDocument();
  });

  it("renders em-dash footer when applied_date is null", () => {
    const card = makeCard({ id: 4, status: "applied", applied_date: undefined });
    wrap(<ApplicationCard card={card} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
