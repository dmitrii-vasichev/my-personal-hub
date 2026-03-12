import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagPill, TagPills } from "@/components/tasks/tag-pill";
import type { TagBrief } from "@/types/tag";

const mockTag: TagBrief = { id: 1, name: "Work", color: "#4f8ef7" };

describe("TagPill", () => {
  it("renders tag name", () => {
    render(<TagPill tag={mockTag} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("applies color styling", () => {
    render(<TagPill tag={mockTag} />);
    const pill = screen.getByText("Work");
    expect(pill.style.color).toMatch(/#4f8ef7|rgb\(79, 142, 247\)/);
    expect(pill.style.backgroundColor).toContain("rgba(79, 142, 247");
  });

  it("shows remove button when onRemove provided", () => {
    const onRemove = vi.fn();
    render(<TagPill tag={mockTag} onRemove={onRemove} />);
    const removeBtn = screen.getByText("×");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("does not show remove button without onRemove", () => {
    render(<TagPill tag={mockTag} />);
    expect(screen.queryByText("×")).not.toBeInTheDocument();
  });
});

describe("TagPills", () => {
  const tags: TagBrief[] = [
    { id: 1, name: "Work", color: "#4f8ef7" },
    { id: 2, name: "Personal", color: "#34d399" },
    { id: 3, name: "Home", color: "#f87171" },
    { id: 4, name: "Car", color: "#fbbf24" },
  ];

  it("renders nothing for empty tags", () => {
    const { container } = render(<TagPills tags={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows max 2 tags by default with overflow", () => {
    render(<TagPills tags={tags} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("respects custom limit", () => {
    render(<TagPills tags={tags} limit={3} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Car")).not.toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("shows all tags when count equals limit", () => {
    render(<TagPills tags={tags.slice(0, 2)} limit={2} />);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });
});
