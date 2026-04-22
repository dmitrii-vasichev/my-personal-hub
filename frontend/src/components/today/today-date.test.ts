import { describe, it, expect } from "vitest";
import { thisWeekBounds } from "./today-date";

describe("thisWeekBounds", () => {
  it("returns Monday 00:00 as start when called on a Wednesday", () => {
    // 2026-04-22 is a Wednesday. Monday of that week: 2026-04-20.
    const now = new Date(2026, 3, 22, 15, 30, 0); // month is 0-indexed
    const { start, end } = thisWeekBounds(now);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3); // April
    expect(start.getDate()).toBe(20);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getDate()).toBe(26); // Sunday 2026-04-26
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it("treats Sunday as the last day of the current week, not the first", () => {
    // 2026-04-26 is a Sunday. Monday of same week: 2026-04-20.
    const now = new Date(2026, 3, 26, 12, 0, 0);
    const { start, end } = thisWeekBounds(now);
    expect(start.getDate()).toBe(20);
    expect(end.getDate()).toBe(26);
  });

  it("produces ISO strings matching the Date bounds", () => {
    const now = new Date(2026, 3, 22, 10, 0, 0);
    const { start, end, startIso, endIso } = thisWeekBounds(now);
    expect(startIso).toBe(start.toISOString());
    expect(endIso).toBe(end.toISOString());
  });
});
