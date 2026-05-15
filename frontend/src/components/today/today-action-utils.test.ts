import { describe, expect, it } from "vitest";
import type { Action } from "@/types/action";
import {
  actionBelongsToLocalDay,
  localDateString,
  sortTodayActions,
  withLocalTzOffset,
} from "./today-action-utils";

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    user_id: 1,
    title: "Action",
    details: null,
    checklist: [],
    action_date: "2026-05-15",
    remind_at: null,
    mode: "anytime",
    status: "pending",
    snoozed_until: null,
    recurrence_rule: null,
    snooze_count: 0,
    notification_sent_count: 0,
    completed_at: null,
    is_floating: true,
    is_urgent: false,
    created_at: "2026-05-15T12:00:00Z",
    updated_at: "2026-05-15T12:00:00Z",
    ...overrides,
  };
}

describe("today-action-utils", () => {
  it("formats local dates as yyyy-mm-dd", () => {
    expect(localDateString(new Date(2026, 4, 5, 9, 0, 0))).toBe("2026-05-05");
  });

  it("creates local timezone ISO strings for selected times", () => {
    expect(withLocalTzOffset("2026-05-15", "09:30")).toMatch(
      /^2026-05-15T09:30:00[+-]\d{2}:\d{2}$/
    );
  });

  it("matches actions by action_date or remind_at on the reference local day", () => {
    const ref = new Date(2026, 4, 15, 12, 0, 0);
    expect(actionBelongsToLocalDay(makeAction({ action_date: "2026-05-15" }), ref)).toBe(true);
    expect(actionBelongsToLocalDay(makeAction({ action_date: "2026-05-16" }), ref)).toBe(false);
    expect(
      actionBelongsToLocalDay(
        makeAction({ action_date: null, remind_at: "2026-05-15T18:00:00-06:00" }),
        ref
      )
    ).toBe(true);
  });

  it("sorts timed actions first, then urgent anytime, then creation time", () => {
    const sorted = sortTodayActions([
      makeAction({ id: 1, title: "Anytime normal", created_at: "2026-05-15T12:00:00Z" }),
      makeAction({
        id: 2,
        title: "Scheduled late",
        remind_at: "2026-05-15T18:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 3,
        title: "Scheduled early",
        remind_at: "2026-05-15T09:00:00-06:00",
        is_floating: false,
      }),
      makeAction({
        id: 4,
        title: "Anytime urgent",
        is_urgent: true,
        created_at: "2026-05-15T13:00:00Z",
      }),
    ]);

    expect(sorted.map((action) => action.title)).toEqual([
      "Scheduled early",
      "Scheduled late",
      "Anytime urgent",
      "Anytime normal",
    ]);
  });
});
