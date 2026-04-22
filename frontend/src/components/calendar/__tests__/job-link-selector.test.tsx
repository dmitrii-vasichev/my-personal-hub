import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { JobLinkSelector } from "../job-link-selector";
import type { JobHintResponse } from "@/types/calendar";

// Hoisted state for the mocked hooks — mutated per test via the helpers
// below so the component re-renders against different fixtures without
// rebuilding module mocks.
const { jobsState, hintState } = vi.hoisted(() => ({
  jobsState: {
    data: [] as Array<{ id: number; title: string; company: string }>,
  },
  hintState: { data: null as JobHintResponse | null },
}));

vi.mock("@/hooks/use-jobs", () => ({
  useJobs: () => ({ data: jobsState.data }),
  JOBS_KEY: "jobs",
}));

vi.mock("@/hooks/use-event-job-hint", () => ({
  useEventJobHint: () => ({ data: hintState.data }),
  EVENT_JOB_HINT_KEY: "event-job-hint",
}));

const acme = { id: 7, title: "Senior Engineer", company: "Acme" };
const globex = { id: 8, title: "Staff SWE", company: "Globex" };

beforeEach(() => {
  jobsState.data = [acme, globex];
  hintState.data = null;
});

describe("JobLinkSelector", () => {
  it("renders current job name when currentJobId is set", () => {
    render(
      <JobLinkSelector
        eventId={10}
        currentJobId={acme.id}
        onChange={() => {}}
      />,
    );
    const label = screen.getByTestId("linked-job-label");
    expect(label.textContent).toBe("Acme — Senior Engineer");
    // Clear button present instead of dropdown.
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("renders hint sub-line when hint is present and currentJobId is null", () => {
    hintState.data = {
      suggested_job_id: acme.id,
      match_reason: "substring",
      job: { id: acme.id, title: acme.title, company: acme.company, status: "applied" },
    };
    render(
      <JobLinkSelector
        eventId={10}
        currentJobId={null}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText(/suggested: acme/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /link/i })).toBeInTheDocument();
  });

  it("clicking hint Link button calls onChange with suggested_job_id", () => {
    hintState.data = {
      suggested_job_id: acme.id,
      match_reason: "substring",
      job: { id: acme.id, title: acme.title, company: acme.company, status: null },
    };
    const onChange = vi.fn();
    render(
      <JobLinkSelector
        eventId={10}
        currentJobId={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /link/i }));
    expect(onChange).toHaveBeenCalledWith(acme.id);
  });

  it("clicking Clear on linked state calls onChange(null)", () => {
    const onChange = vi.fn();
    render(
      <JobLinkSelector
        eventId={10}
        currentJobId={acme.id}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("dropdown selection calls onChange with the picked job id", () => {
    const onChange = vi.fn();
    render(
      <JobLinkSelector
        eventId={10}
        currentJobId={null}
        onChange={onChange}
      />,
    );
    const select = screen.getByRole("combobox", { name: /link to job/i });
    fireEvent.change(select, { target: { value: String(globex.id) } });
    expect(onChange).toHaveBeenCalledWith(globex.id);
  });
});
