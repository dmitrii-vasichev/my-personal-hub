import { describe, it, expect } from "vitest";
import { daysSince } from "./days-since";

describe("daysSince", () => {
  const ref = new Date(2026, 3, 20); // 2026-04-20 local midnight

  it("returns 0 for today", () => {
    expect(daysSince("2026-04-20", ref)).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince("2026-04-19", ref)).toBe(1);
  });

  it("returns 10 for 10 days ago", () => {
    expect(daysSince("2026-04-10", ref)).toBe(10);
  });

  it("returns null for null input", () => {
    expect(daysSince(null, ref)).toBeNull();
    expect(daysSince(undefined, ref)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(daysSince("not-a-date", ref)).toBeNull();
  });

  it("returns a negative number for a future date (documented behavior)", () => {
    expect(daysSince("2026-04-22", ref)).toBe(-2);
  });
});
