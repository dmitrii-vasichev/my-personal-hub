import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TagPicker } from "@/components/tasks/tag-picker";

const mockTags = [
  { id: 1, name: "Work", color: "#4f8ef7", task_count: 5, created_at: "2026-01-01" },
  { id: 2, name: "Personal", color: "#34d399", task_count: 3, created_at: "2026-01-01" },
];

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: mockTags }),
  useCreateTag: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: 3, name: "New", color: "#f87171" }),
    isPending: false,
  }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TagPicker", () => {
  let onChange: (ids: number[]) => void;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders placeholder when no tags selected", () => {
    render(
      <Wrapper>
        <TagPicker selectedTagIds={[]} onChange={onChange} />
      </Wrapper>
    );
    expect(screen.getByText("Select tags…")).toBeInTheDocument();
  });

  it("shows tags dropdown on click", () => {
    render(
      <Wrapper>
        <TagPicker selectedTagIds={[]} onChange={onChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Select tags…"));
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("toggles tag selection", () => {
    render(
      <Wrapper>
        <TagPicker selectedTagIds={[]} onChange={onChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Select tags…"));
    fireEvent.click(screen.getByText("Work"));
    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("shows selected tags as pills", () => {
    render(
      <Wrapper>
        <TagPicker selectedTagIds={[1]} onChange={onChange} />
      </Wrapper>
    );
    // Selected tag "Work" should be visible as a pill in the trigger
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("shows Create tag option", () => {
    render(
      <Wrapper>
        <TagPicker selectedTagIds={[]} onChange={onChange} />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Select tags…"));
    expect(screen.getByText("Create tag")).toBeInTheDocument();
  });
});
