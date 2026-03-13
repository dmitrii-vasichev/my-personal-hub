import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TagsManagementTab } from "@/components/settings/tags-management-tab";

const mockTags = [
  { id: 1, name: "Work", color: "#4f8ef7", task_count: 5, created_at: "2026-01-01" },
  { id: 2, name: "Personal", color: "#34d399", task_count: 1, created_at: "2026-01-01" },
  { id: 3, name: "Urgent", color: "#f87171", task_count: 0, created_at: "2026-01-01" },
];

const mockCreateTag = vi.fn().mockResolvedValue({ id: 4, name: "New Tag", color: "#4f8ef7" });
const mockUpdateTag = vi.fn().mockResolvedValue({});
const mockDeleteTag = vi.fn().mockResolvedValue(undefined);

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: mockTags, isLoading: false }),
  useCreateTag: () => ({
    mutateAsync: mockCreateTag,
    isPending: false,
  }),
  useUpdateTag: () => ({
    mutateAsync: mockUpdateTag,
    isPending: false,
  }),
  useDeleteTag: () => ({
    mutateAsync: mockDeleteTag,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TagsManagementTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tag list with names, colors, and task counts", () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();
    expect(screen.getByText("5 tasks")).toBeInTheDocument();
    expect(screen.getByText("1 task")).toBeInTheDocument();
    expect(screen.getByText("0 tasks")).toBeInTheDocument();
  });

  it("shows N/20 counter", () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    expect(screen.getByText("3 / 20 tags")).toBeInTheDocument();
  });

  it("shows create tag form when button is clicked", () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Create tag"));
    expect(screen.getByPlaceholderText("Tag name")).toBeInTheDocument();
  });

  it("creates a tag and calls mutateAsync", async () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Create tag"));
    const input = screen.getByPlaceholderText("Tag name");
    fireEvent.change(input, { target: { value: "New Tag" } });
    fireEvent.click(screen.getByText("Create"));

    await waitFor(() => {
      expect(mockCreateTag).toHaveBeenCalledWith({ name: "New Tag", color: "#4f8ef7" });
    });
  });

  it("enters edit mode when tag name is clicked", () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    fireEvent.click(screen.getByText("Work"));
    // Edit mode should show Save/Cancel buttons
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("shows delete confirmation dialog", () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    // Find delete buttons (trash icons) — they're hidden on hover, but we can still click them
    const deleteButtons = screen.getAllByTitle("Delete tag");
    fireEvent.click(deleteButtons[0]);
    expect(screen.getByText(/Delete tag.*Work/)).toBeInTheDocument();
    expect(screen.getByText(/removed from 5 tasks/)).toBeInTheDocument();
  });

  it("calls deleteTag on confirmation", async () => {
    render(
      <Wrapper>
        <TagsManagementTab />
      </Wrapper>
    );
    const deleteButtons = screen.getAllByTitle("Delete tag");
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(mockDeleteTag).toHaveBeenCalledWith(1);
    });
  });
});
