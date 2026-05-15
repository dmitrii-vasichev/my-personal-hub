import type { Action } from "@/types/action";
import { isSameLocalDay, parseLocalDateSource } from "./today-date";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function localDateString(date: Date = new Date()): string {
  return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join("-");
}

export function withLocalTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function actionBelongsToLocalDay(action: Action, ref: Date = new Date()): boolean {
  const source = action.action_date ?? action.remind_at;
  return isSameLocalDay(source, ref);
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
