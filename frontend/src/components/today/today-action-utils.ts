import type { Action } from "@/types/action";
import { isSameLocalDay, parseLocalDateSource } from "./today-date";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function localDateString(date: Date = new Date()): string {
  return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join("-");
}

export function withLocalTzOffset(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const selected = new Date(year, month - 1, day, hour, minute, 0);
  const offset = selected.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function actionBelongsToLocalDay(action: Action, ref: Date = new Date()): boolean {
  return isSameLocalDay(action.action_date, ref) || isSameLocalDay(action.remind_at, ref);
}

function localDayTimestamp(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function sourceIsDueByLocalDay(source: string | null | undefined, ref: Date): boolean {
  const parsed = parseLocalDateSource(source);
  if (!parsed) return false;
  return localDayTimestamp(parsed) <= localDayTimestamp(ref);
}

export function actionIsDueByLocalDay(action: Action, ref: Date = new Date()): boolean {
  return (
    sourceIsDueByLocalDay(action.action_date, ref) ||
    sourceIsDueByLocalDay(action.remind_at, ref)
  );
}

export function sortTodayActions(actions: Action[]): Action[] {
  return [...actions].sort((a, b) => {
    const aScheduled = a.remind_at ? 0 : 1;
    const bScheduled = b.remind_at ? 0 : 1;
    if (aScheduled !== bScheduled) return aScheduled - bScheduled;

    if (a.remind_at && b.remind_at) {
      return (
        parseLocalDateSource(a.remind_at)!.getTime() -
        parseLocalDateSource(b.remind_at)!.getTime()
      );
    }

    const aUrgent = a.is_urgent ? 0 : 1;
    const bUrgent = b.is_urgent ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export interface TodayActionSections {
  overdue: Action[];
  today: Action[];
}

/** Split pending actions that are due by the reference local day.
 *  Planned for that day (action_date or remind_at) stays in Today.
 *  Earlier dates, and only those, go to Overdue. Future and done items are dropped.
 */
export function partitionDueTodayActions(
  actions: Action[],
  ref: Date = new Date()
): TodayActionSections {
  const overdue: Action[] = [];
  const today: Action[] = [];

  for (const action of actions) {
    if (action.status !== "pending") continue;
    if (actionBelongsToLocalDay(action, ref)) {
      today.push(action);
    } else if (actionIsDueByLocalDay(action, ref)) {
      overdue.push(action);
    }
  }

  return {
    overdue: sortTodayActions(overdue),
    today: sortTodayActions(today),
  };
}
