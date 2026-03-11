import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { NoteViewer } from "@/components/notes/note-viewer";

describe("NoteViewer", () => {
  it("renders heading elements from markdown", () => {
    render(<NoteViewer content="# Hello World" />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Hello World");
  });

  it("renders multiple heading levels", () => {
    render(<NoteViewer content={"# H1\n\n## H2\n\n### H3"} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("H1");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("H2");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("H3");
  });

  it("renders code blocks", () => {
    const { container } = render(
      <NoteViewer content={'```js\nconsole.log("hello");\n```'} />
    );
    const codeEl = container.querySelector("code");
    expect(codeEl).toBeInTheDocument();
    expect(codeEl?.textContent).toContain("console");
  });

  it("renders tables (GFM)", () => {
    const markdown = "| Name | Age |\n|------|-----|\n| Alice | 30 |";
    render(<NoteViewer content={markdown} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("renders links with target=_blank", () => {
    render(<NoteViewer content="[Google](https://google.com)" />);
    const link = screen.getByRole("link", { name: "Google" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders bold and italic text", () => {
    render(<NoteViewer content="**bold** and *italic*" />);
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("italic")).toBeInTheDocument();
  });

  it("renders unordered lists", () => {
    render(
      <NoteViewer content={"- item 1\n\n- item 2\n\n- item 3"} />
    );
    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();
  });

  it("has prose styling container", () => {
    const { container } = render(<NoteViewer content="# Test" />);
    const wrapper = container.querySelector("[data-testid='note-viewer']");
    expect(wrapper?.className).toContain("prose");
  });
});
