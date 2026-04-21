export type PlannedMinutes = 25 | 50 | 90;

export interface FocusSession {
  id: number;
  user_id: number;
  task_id: number | null;
  plan_item_id: number | null;
  started_at: string;
  ended_at: string | null;
  planned_minutes: number;
  auto_closed: boolean;
  actual_minutes: number | null;
  task_title: string | null;
  plan_item_title: string | null;
}

export interface StartFocusBody {
  task_id?: number | null;
  plan_item_id?: number | null;
  planned_minutes: PlannedMinutes;
}

export interface FocusSessionTodayResponse {
  sessions: FocusSession[];
  total_minutes: number;
  count: number;
}

/**
 * Format minutes as compact human-readable label.
 * Examples: 0 → "0m", 45 → "45m", 60 → "1h", 135 → "2h 15m".
 */
export function formatFocusMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
