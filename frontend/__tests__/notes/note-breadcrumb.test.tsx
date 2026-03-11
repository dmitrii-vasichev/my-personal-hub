import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NoteBreadcrumb } from "@/components/notes/note-breadcrumb";

describe("NoteBreadcrumb", () => {
  it("renders path segments", () => {
    render(<NoteBreadcrumb path="Instructions/Backend/deploy-guide.md" />);
    expect(screen.getByText("Instructions")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("deploy-guide.md")).toBeInTheDocument();
  });

  it("styles last segment as current (bold)", () => {
    render(<NoteBreadcrumb path="Folder/file.md" />);
    const lastSegment = screen.getByText("file.md");
    expect(lastSegment.className).toContain("font-semibold");
    expect(lastSegment.className).toContain("text-[var(--text-primary)]");
  });

  it("styles non-last segments as secondary", () => {
    render(<NoteBreadcrumb path="Folder/file.md" />);
    const firstSegment = screen.getByText("Folder");
    expect(firstSegment.className).toContain("text-[var(--text-secondary)]");
  });

  it("renders single segment path", () => {
    render(<NoteBreadcrumb path="README.md" />);
    expect(screen.getByText("README.md")).toBeInTheDocument();
    const segment = screen.getByText("README.md");
    expect(segment.className).toContain("font-semibold");
  });

  it("has the correct test id", () => {
    const { container } = render(<NoteBreadcrumb path="a/b.md" />);
    expect(
      container.querySelector("[data-testid='note-breadcrumb']")
    ).toBeInTheDocument();
  });
});
