import { describe, it, expect } from "vitest";
import { formatAppliedDate } from "./format-applied-date";

describe("formatAppliedDate", () => {
  it("formats a valid date as 'D MMM' uppercase", () => {
    expect(formatAppliedDate("2026-04-10")).toBe("10 APR");
  });

  it("returns em-dash for null", () => {
    expect(formatAppliedDate(null)).toBe("—");
  });

  it("returns em-dash for undefined", () => {
    expect(formatAppliedDate(undefined)).toBe("—");
  });

  it("returns em-dash for invalid input", () => {
    expect(formatAppliedDate("not-a-date")).toBe("—");
  });
});
