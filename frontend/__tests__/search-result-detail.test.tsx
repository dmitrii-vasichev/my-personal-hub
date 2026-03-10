import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchResultDetail } from "@/components/jobs/search-result-detail";
import type { SearchResult } from "@/types/search";

const mockResult: SearchResult = {
  title: "Senior Python Developer",
  company: "Acme Corp",
  location: "San Francisco, CA",
  url: "https://example.com/job/123",
  description: "We are looking for a senior Python developer with experience in FastAPI and PostgreSQL.",
  salary_min: 120000,
  salary_max: 180000,
  salary_currency: "USD",
  source: "adzuna",
  found_at: "2026-03-10T00:00:00Z",
};

describe("SearchResultDetail", () => {
  it("renders all fields when open", () => {
    render(
      <SearchResultDetail
        result={mockResult}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={false}
      />
    );

    expect(screen.getByText("Senior Python Developer")).toBeInTheDocument();
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText(/San Francisco/)).toBeInTheDocument();
    expect(screen.getByText(/\$120,000/)).toBeInTheDocument();
    expect(screen.getByText(/FastAPI/)).toBeInTheDocument();
    expect(screen.getByText("adzuna")).toBeInTheDocument();
  });

  it("renders nothing when result is null", () => {
    const { container } = render(
      <SearchResultDetail
        result={null}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={false}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows Save to Jobs button when not saved", () => {
    render(
      <SearchResultDetail
        result={mockResult}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={false}
      />
    );

    expect(screen.getByText("Save to Jobs")).toBeInTheDocument();
  });

  it("shows Saved state when already saved", () => {
    render(
      <SearchResultDetail
        result={mockResult}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={true}
      />
    );

    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("calls onSave when Save button clicked", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(
      <SearchResultDetail
        result={mockResult}
        open={true}
        onOpenChange={vi.fn()}
        onSave={onSave}
        saved={false}
      />
    );

    await user.click(screen.getByText("Save to Jobs"));
    expect(onSave).toHaveBeenCalledWith(mockResult);
  });

  it("has Open Original link with correct href", () => {
    render(
      <SearchResultDetail
        result={mockResult}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={false}
      />
    );

    const link = screen.getByText("Open Original").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/job/123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("handles result without salary", () => {
    const noSalary = { ...mockResult, salary_min: null, salary_max: null };
    render(
      <SearchResultDetail
        result={noSalary}
        open={true}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        saved={false}
      />
    );

    expect(screen.getByText("Senior Python Developer")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
