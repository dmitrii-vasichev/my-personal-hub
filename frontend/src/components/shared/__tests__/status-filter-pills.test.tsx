import { render, screen, fireEvent } from "@testing-library/react";
import { StatusFilterPills } from "../status-filter-pills";
import { describe, it, expect, vi } from "vitest";

const STATUSES = [
  { value: "open", label: "OPEN", count: 3 },
  { value: "done", label: "DONE", count: 12 },
];

describe("StatusFilterPills", () => {
  it("renders ALL pill plus one per status", () => {
    render(<StatusFilterPills statuses={STATUSES} selected={null} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name: /ALL/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /OPEN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /DONE/ })).toBeInTheDocument();
  });

  it("shows count inside each status pill", () => {
    render(<StatusFilterPills statuses={STATUSES} selected={null} onSelect={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("marks selected pill with data-selected=true", () => {
    render(<StatusFilterPills statuses={STATUSES} selected="open" onSelect={() => {}} />);
    const openPill = screen.getByRole("button", { name: /OPEN/ });
    expect(openPill).toHaveAttribute("data-selected", "true");
    const allPill = screen.getByRole("button", { name: /ALL/ });
    expect(allPill).toHaveAttribute("data-selected", "false");
  });

  it("fires onSelect with value when a status pill is tapped", () => {
    const onSelect = vi.fn();
    render(<StatusFilterPills statuses={STATUSES} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /OPEN/ }));
    expect(onSelect).toHaveBeenCalledWith("open");
  });

  it("fires onSelect(null) when ALL pill is tapped", () => {
    const onSelect = vi.fn();
    render(<StatusFilterPills statuses={STATUSES} selected="open" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /ALL/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
