import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all hooks used by NotesPage
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/hooks/use-notes", () => ({
  useNotesTree: () => ({
    data: {
      folder_id: "root",
      tree: [
        {
          id: "file-1",
          name: "test.md",
          type: "file",
          google_file_id: "gf-1",
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
  useNoteContent: (fileId: string | null) => ({
    data: fileId ? "# Test Note\n\nContent here" : null,
    isLoading: false,
    error: null,
  }),
  useRefreshNotesTree: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
    data: { google_drive_notes_folder_id: "folder-123" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-calendar", () => ({
  useGoogleOAuthStatus: () => ({
    data: { connected: true },
    isLoading: false,
  }),
}));

// Must import after mocks
import NotesPage from "@/app/(dashboard)/notes/page";

describe("Note expand toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show expand button when no file is selected", () => {
    render(<NotesPage />);
    expect(screen.queryByTestId("note-expand-toggle")).not.toBeInTheDocument();
  });

  it("shows expand button when a file is selected", async () => {
    const user = userEvent.setup();
    render(<NotesPage />);

    // Select a file from the tree
    await user.click(screen.getByText("test.md"));

    expect(screen.getByTestId("note-expand-toggle")).toBeInTheDocument();
  });

  it("hides tree panel when expanded", async () => {
    const user = userEvent.setup();
    const { container } = render(<NotesPage />);

    // Select file
    await user.click(screen.getByText("test.md"));

    // Tree should be visible
    const gridBefore = container.querySelector(".grid");
    expect(gridBefore?.className).not.toContain("grid-cols-1");

    // Click expand
    await user.click(screen.getByTestId("note-expand-toggle"));

    // Grid should be single column, tree hidden
    const gridAfter = container.querySelector(".grid");
    expect(gridAfter?.className).toContain("grid-cols-1");
  });

  it("restores tree panel when collapsed", async () => {
    const user = userEvent.setup();
    const { container } = render(<NotesPage />);

    await user.click(screen.getByText("test.md"));

    // Expand then collapse
    await user.click(screen.getByTestId("note-expand-toggle"));
    await user.click(screen.getByTestId("note-expand-toggle"));

    const grid = container.querySelector(".grid");
    expect(grid?.className).not.toContain("grid-cols-1");
  });

  it("exits expanded mode on Escape key", async () => {
    const user = userEvent.setup();
    const { container } = render(<NotesPage />);

    await user.click(screen.getByText("test.md"));
    await user.click(screen.getByTestId("note-expand-toggle"));

    // Verify expanded
    expect(container.querySelector(".grid")?.className).toContain("grid-cols-1");

    // Press Escape
    await user.keyboard("{Escape}");

    expect(container.querySelector(".grid")?.className).not.toContain("grid-cols-1");
  });
});
