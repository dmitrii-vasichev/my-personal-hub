import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { NoteTree } from "@/components/notes/note-tree";
import type { NoteTreeNode } from "@/types/note";

const mockTree: NoteTreeNode[] = [
  {
    id: "folder-1",
    name: "Backend",
    type: "folder",
    google_file_id: "folder-1-id",
    children: [
      {
        id: "file-1",
        name: "deploy-guide.md",
        type: "file",
        google_file_id: "file-1-id",
      },
      {
        id: "file-2",
        name: "api-docs.md",
        type: "file",
        google_file_id: "file-2-id",
      },
    ],
  },
  {
    id: "file-3",
    name: "README.md",
    type: "file",
    google_file_id: "file-3-id",
  },
];

describe("NoteTree", () => {
  it("renders folder and file nodes", () => {
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("README.md")).toBeInTheDocument();
  });

  it("shows folder children when expanded (folders default expanded)", () => {
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Backend folder should be expanded by default (top-level folders)
    expect(screen.getByText("api-docs.md")).toBeInTheDocument();
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
  });

  it("collapses folder on click and hides children", async () => {
    const user = userEvent.setup();
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Click Backend folder to collapse
    await user.click(screen.getByText("Backend"));
    expect(screen.queryByText("deploy-guide.md")).not.toBeInTheDocument();
  });

  it("calls onSelectFile when clicking a file", async () => {
    const onSelectFile = vi.fn();
    const user = userEvent.setup();
    render(
      <NoteTree
        tree={mockTree}
        selectedFileId={null}
        onSelectFile={onSelectFile}
      />
    );

    await user.click(screen.getByText("README.md"));
    expect(onSelectFile).toHaveBeenCalledWith("file-3-id", "README.md");
  });

  it("calls onSelectFile with full path for nested files", async () => {
    const onSelectFile = vi.fn();
    const user = userEvent.setup();
    render(
      <NoteTree
        tree={mockTree}
        selectedFileId={null}
        onSelectFile={onSelectFile}
      />
    );

    await user.click(screen.getByText("deploy-guide.md"));
    expect(onSelectFile).toHaveBeenCalledWith(
      "file-1-id",
      "Backend/deploy-guide.md"
    );
  });

  it("highlights selected file", () => {
    render(
      <NoteTree
        tree={mockTree}
        selectedFileId="file-3-id"
        onSelectFile={vi.fn()}
      />
    );

    const fileButton = screen.getByText("README.md").closest("button");
    expect(fileButton?.className).toContain("text-[var(--accent)]");
  });

  it("sorts folders before files", () => {
    const { container } = render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    const buttons = container.querySelectorAll("[data-testid='note-tree'] > div > button");
    // First button should be the folder (Backend), second should be the file (README.md)
    expect(buttons[0]).toHaveTextContent("Backend");
    expect(buttons[1]).toHaveTextContent("README.md");
  });
});
