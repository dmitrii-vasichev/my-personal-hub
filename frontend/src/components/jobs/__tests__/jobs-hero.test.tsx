import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { JobsHero } from "../jobs-hero";
import type { ApplicationStatus, Job } from "@/types/job";

function makeJob(status: ApplicationStatus | undefined, id = 1): Job {
  return {
    id,
    user_id: 1,
    title: `Job ${id}`,
    company: "ACME",
    source: "manual",
    salary_currency: "USD",
    salary_period: "year",
    tags: [],
    created_at: "2026-04-20T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
    status,
  };
}

describe("JobsHero", () => {
  it("renders 4 cells with correct counts", () => {
    const jobs: Job[] = [
      makeJob("applied", 1),
      makeJob("applied", 2),
      makeJob("applied", 3),
      makeJob("screening", 4),
      makeJob("technical_interview", 5),
      makeJob("final_interview", 6),
      makeJob("offer", 7),
      makeJob("rejected", 8), // not in any bucket
    ];
    render(<JobsHero jobs={jobs} />);

    const applied = screen.getByTestId("jobs-hero-cell-applied");
    const screen_ = screen.getByTestId("jobs-hero-cell-screen");
    const interview = screen.getByTestId("jobs-hero-cell-interview");
    const offer = screen.getByTestId("jobs-hero-cell-offer");

    expect(applied).toHaveTextContent("Applied");
    expect(applied).toHaveTextContent("3");
    expect(screen_).toHaveTextContent("Screen");
    expect(screen_).toHaveTextContent("1");
    expect(interview).toHaveTextContent("Interview");
    expect(interview).toHaveTextContent("2");
    expect(offer).toHaveTextContent("Offer");
    expect(offer).toHaveTextContent("1");
  });

  it("renders zero case with bars at 0% width", () => {
    render(<JobsHero jobs={[]} />);

    const bars = [
      screen.getByTestId("jobs-hero-bar-applied"),
      screen.getByTestId("jobs-hero-bar-screen"),
      screen.getByTestId("jobs-hero-bar-interview"),
      screen.getByTestId("jobs-hero-bar-offer"),
    ];
    for (const bar of bars) {
      expect(bar).toHaveStyle({ width: "0%" });
    }
  });

  it("scales bars proportionally to max bucket count", () => {
    // Applied=4, Screen=2, Interview=1, Offer=0
    const jobs: Job[] = [
      makeJob("applied", 1),
      makeJob("applied", 2),
      makeJob("applied", 3),
      makeJob("applied", 4),
      makeJob("screening", 5),
      makeJob("screening", 6),
      makeJob("technical_interview", 7),
    ];
    render(<JobsHero jobs={jobs} />);

    expect(screen.getByTestId("jobs-hero-bar-applied")).toHaveStyle({
      width: "100%",
    });
    expect(screen.getByTestId("jobs-hero-bar-screen")).toHaveStyle({
      width: "50%",
    });
    expect(screen.getByTestId("jobs-hero-bar-interview")).toHaveStyle({
      width: "25%",
    });
    expect(screen.getByTestId("jobs-hero-bar-offer")).toHaveStyle({
      width: "0%",
    });
  });
});
