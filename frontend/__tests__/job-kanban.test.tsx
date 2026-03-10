import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApplicationKanban } from "@/components/jobs/application-kanban";
import type { KanbanData } from "@/types/job";

// Mock dnd-kit
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: class {},
  useSensor: () => ({}),
  useSensors: () => [],
}));

// Mock child components
vi.mock("@/components/jobs/application-column", () => ({
  ApplicationColumn: ({ status, cards }: { status: string; cards: unknown[] }) => (
    <div data-testid={`column-${status}`}>
      <span>{status}</span>
      <span data-testid={`count-${status}`}>{cards.length}</span>
    </div>
  ),
}));
vi.mock("@/components/jobs/application-card", () => ({
  ApplicationCardOverlay: () => null,
}));
vi.mock("@/components/jobs/status-change-dialog", () => ({
  StatusChangeDialog: () => null,
}));

const emptyKanban: KanbanData = {
  found: [],
  saved: [],
  resume_generated: [],
  applied: [],
  screening: [],
  technical_interview: [],
  final_interview: [],
  offer: [],
  accepted: [],
  rejected: [],
  ghosted: [],
  withdrawn: [],
};

const mockUseJobKanban = vi.fn();

vi.mock("@/hooks/use-jobs", () => ({
  useJobKanban: () => mockUseJobKanban(),
}));

describe("ApplicationKanban", () => {
  it("shows loading skeleton when loading", () => {
    mockUseJobKanban.mockReturnValue({ data: undefined, isLoading: true, error: null });
    const { container } = render(<ApplicationKanban />);

    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows error state on failure", () => {
    mockUseJobKanban.mockReturnValue({ data: null, isLoading: false, error: new Error("fail") });
    render(<ApplicationKanban />);

    expect(screen.getByText("Failed to load pipeline")).toBeInTheDocument();
  });

  it("shows empty state when no tracked jobs", () => {
    mockUseJobKanban.mockReturnValue({ data: emptyKanban, isLoading: false, error: null });
    render(<ApplicationKanban />);

    expect(screen.getByText("No tracked jobs yet")).toBeInTheDocument();
  });

  it("renders columns with cards from kanban data", () => {
    const data: KanbanData = {
      ...emptyKanban,
      applied: [
        {
          id: 1,
          status: "applied",
          title: "Engineer",
          company: "Corp",
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ],
      screening: [
        {
          id: 2,
          status: "screening",
          title: "Dev",
          company: "Inc",
          created_at: "2026-03-01T00:00:00Z",
          updated_at: "2026-03-01T00:00:00Z",
        },
      ],
    };
    mockUseJobKanban.mockReturnValue({ data, isLoading: false, error: null });
    render(<ApplicationKanban />);

    expect(screen.getByTestId("count-applied")).toHaveTextContent("1");
    expect(screen.getByTestId("count-screening")).toHaveTextContent("1");
    expect(screen.getByTestId("count-found")).toHaveTextContent("0");
  });
});
