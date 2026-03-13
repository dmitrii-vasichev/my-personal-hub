import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TaskFiltersBar } from "@/components/tasks/task-filters";
import type { TaskFilters } from "@/types/task";

const mockTags = [
  { id: 1, name: "Hub", color: "#4f8ef7", task_count: 5, created_at: "2026-01-01" },
  { id: 2, name: "Learning", color: "#f87171", task_count: 3, created_at: "2026-01-01" },
  { id: 3, name: "Portfolio", color: "#34d399", task_count: 2, created_at: "2026-01-01" },
];

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: mockTags }),
  useCreateTag: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TaskFiltersBar — multi-tag filter", () => {
  let onFiltersChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onFiltersChange = vi.fn();
  });

  it("renders Tags button with all tags available", () => {
    render(
      <Wrapper>
        <TaskFiltersBar filters={{}} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("shows all tags and No tag in dropdown", () => {
    render(
      <Wrapper>
        <TaskFiltersBar filters={{}} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    expect(screen.getByText("All tags")).toBeInTheDocument();
    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Portfolio")).toBeInTheDocument();
    expect(screen.getByText("No tag")).toBeInTheDocument();
  });

  it("deselects one tag from all-selected state", () => {
    render(
      <Wrapper>
        <TaskFiltersBar filters={{}} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByText("Hub"));

    // Should deselect Hub (keep Learning, Portfolio, untagged)
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: [2, 3],
        include_untagged: true,
      })
    );
  });

  it("toggles All tags to deselect all", () => {
    render(
      <Wrapper>
        <TaskFiltersBar filters={{}} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByText("All tags"));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: [],
        include_untagged: false,
      })
    );
  });

  it("toggles All tags to select all from partial state", () => {
    const filters: TaskFilters = { tag_ids: [1], include_untagged: false };
    render(
      <Wrapper>
        <TaskFiltersBar filters={filters} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByText("All tags"));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: undefined,
        include_untagged: undefined,
      })
    );
  });

  it("toggles No tag from all-selected state", () => {
    render(
      <Wrapper>
        <TaskFiltersBar filters={{}} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByText("No tag"));

    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: [1, 2, 3],
        include_untagged: false,
      })
    );
  });

  it("shows badge count when filter is active", () => {
    const filters: TaskFilters = { tag_ids: [1, 2], include_untagged: false };
    render(
      <Wrapper>
        <TaskFiltersBar filters={filters} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    // Badge should show "2" (two tags selected)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("re-selects all when last deselected tag is toggled back", () => {
    // Only Hub is deselected — selecting it back should return to "all" state
    const filters: TaskFilters = { tag_ids: [2, 3], include_untagged: true };
    render(
      <Wrapper>
        <TaskFiltersBar filters={filters} onFiltersChange={onFiltersChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Tags"));
    fireEvent.click(screen.getByText("Hub"));

    // All tags + untagged selected → should clear to "all" state
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tag_ids: undefined,
        include_untagged: undefined,
      })
    );
  });
});
