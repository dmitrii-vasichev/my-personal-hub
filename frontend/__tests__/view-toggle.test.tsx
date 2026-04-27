import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewToggle } from "@/components/jobs/view-toggle";

describe("ViewToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders both Table and Kanban options", () => {
    render(<ViewToggle onChange={() => {}} />);

    expect(screen.getByText("Table")).toBeInTheDocument();
    expect(screen.getByText("Kanban")).toBeInTheDocument();
  });

  it("defaults to kanban when no localStorage preference", () => {
    const onChange = vi.fn();
    render(<ViewToggle onChange={onChange} />);

    // Initial internal state is "kanban"; no onChange fires when no stored value.
    const kanbanButton = screen.getByText("Kanban").closest("button");
    expect(kanbanButton?.getAttribute("aria-selected")).toBe("true");
  });

  it("restores kanban preference from localStorage", () => {
    localStorage.setItem("jobs-view-preference", "kanban");
    const onChange = vi.fn();
    render(<ViewToggle onChange={onChange} />);

    expect(onChange).toHaveBeenCalledWith("kanban");
  });

  it("switches view on click and persists to localStorage", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle onChange={onChange} />);

    await user.click(screen.getByText("Kanban"));

    expect(onChange).toHaveBeenCalledWith("kanban");
    expect(localStorage.getItem("jobs-view-preference")).toBe("kanban");
  });

  it("switches back to table on click", async () => {
    localStorage.setItem("jobs-view-preference", "kanban");
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle value="kanban" onChange={onChange} />);

    await user.click(screen.getByText("Table"));

    expect(onChange).toHaveBeenCalledWith("table");
    expect(localStorage.getItem("jobs-view-preference")).toBe("table");
  });

  it("accepts controlled value prop", () => {
    render(<ViewToggle value="kanban" onChange={() => {}} />);

    // The kanban button should have the active style (accent bg)
    const kanbanButton = screen.getByText("Kanban").closest("button");
    expect(kanbanButton?.className).toContain("bg-[color:var(--accent)]");
    expect(kanbanButton?.getAttribute("aria-selected")).toBe("true");
  });
});
