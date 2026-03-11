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

  it("folders are collapsed by default", () => {
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Backend folder should be collapsed — children not visible
    expect(screen.queryByText("api-docs.md")).not.toBeInTheDocument();
    expect(screen.queryByText("deploy-guide.md")).not.toBeInTheDocument();
  });

  it("expands folder on click and shows children", async () => {
    const user = userEvent.setup();
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Click Backend folder to expand
    await user.click(screen.getByText("Backend"));
    expect(screen.getByText("api-docs.md")).toBeInTheDocument();
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
  });

  it("collapses folder on second click", async () => {
    const user = userEvent.setup();
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Expand then collapse
    await user.click(screen.getByText("Backend"));
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
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

    // Expand folder first, then click file
    await user.click(screen.getByText("Backend"));
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
    expect(fileButton?.className).toContain("text-[var(--accent-foreground)]");
  });

  it("expand all button expands all folders", async () => {
    const user = userEvent.setup();
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Folders collapsed by default
    expect(screen.queryByText("api-docs.md")).not.toBeInTheDocument();

    // Click "Expand" button
    await user.click(screen.getByText("Expand"));
    expect(screen.getByText("api-docs.md")).toBeInTheDocument();
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
  });

  it("collapse all button collapses all folders", async () => {
    const user = userEvent.setup();
    render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    // Expand all first
    await user.click(screen.getByText("Expand"));
    expect(screen.getByText("api-docs.md")).toBeInTheDocument();

    // Collapse all
    await user.click(screen.getByText("Collapse"));
    expect(screen.queryByText("api-docs.md")).not.toBeInTheDocument();
  });

  it("auto-expands parents when autoExpandFileId is set", () => {
    render(
      <NoteTree
        tree={mockTree}
        selectedFileId="file-1-id"
        onSelectFile={vi.fn()}
        autoExpandFileId="file-1-id"
      />
    );

    // Backend folder should auto-expand to show the selected file
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
  });

  it("sorts folders before files", () => {
    const { container } = render(
      <NoteTree tree={mockTree} selectedFileId={null} onSelectFile={vi.fn()} />
    );

    const treeDiv = container.querySelector("[data-testid='note-tree']");
    const scrollableDiv = treeDiv?.querySelector(".overflow-y-auto");
    const buttons = scrollableDiv?.querySelectorAll(":scope > div > button");
    // First button should be the folder (Backend), second should be the file (README.md)
    expect(buttons?.[0]).toHaveTextContent("Backend");
    expect(buttons?.[1]).toHaveTextContent("README.md");
  });
});
