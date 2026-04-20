export type PlanItemStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "skipped"
  | "rescheduled";

export interface PlanItem {
  id: number;
  plan_id: number;
  order: number;
  title: string;
  category: string | null;
  minutes_planned: number;
  minutes_actual: number | null;
  status: PlanItemStatus;
  linked_task_id: number | null;
  task_title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyPlan {
  id: number;
  user_id: number;
  date: string;
  available_minutes: number;
  planned_minutes: number;
  completed_minutes: number;
  adherence_pct: number | null;
  replans_count: number;
  categories_planned: Record<string, number>;
  categories_actual: Record<string, number>;
  items: PlanItem[];
  created_at: string;
  updated_at: string;
}

export interface ContextEvent {
  id: string;
  title: string;
  start: string;
  end: string;
}

export interface ContextReminder {
  id: number;
  title: string;
  remind_at: string;
  is_urgent: boolean;
  task_id: number | null;
}

export interface ContextTask {
  id: number;
  title: string;
  priority: string;
  deadline: string | null;
  category: string | null;
}

export interface YesterdaySummary {
  adherence_pct: number | null;
  completed_minutes: number;
  replans_count: number;
}

export interface PlannerContext {
  date: string;
  timezone: string;
  pending_tasks: ContextTask[];
  due_reminders: ContextReminder[];
  calendar_events: ContextEvent[];
  yesterday: YesterdaySummary | null;
}

export interface AnalyticsDailyPoint {
  date: string;
  adherence: number | null;
  planned: number;
  completed: number;
  replans: number;
}

export interface AnalyticsResponse {
  from: string;
  to: string;
  days_count: number;
  avg_adherence: number | null;
  total_planned_minutes: number;
  total_completed_minutes: number;
  minutes_by_category: Record<string, number>;
  longest_streak: number;
  replans_total: number;
  daily_series: AnalyticsDailyPoint[];
}

export interface PatchPlanItemBody {
  status?: PlanItemStatus;
  minutes_actual?: number;
  notes?: string;
  title?: string;
  category?: string;
  minutes_planned?: number;
  order?: number;
}

export const CATEGORY_LABEL: Record<string, string> = {
  language: "LANG",
  career: "CAREER",
  home: "HOME",
  life: "LIFE",
};

export function labelForCategory(key: string | null): string {
  if (!key) return "—";
  return CATEGORY_LABEL[key] ?? key.toUpperCase();
}

export const UNCHECKED_STATUSES: PlanItemStatus[] = [
  "pending",
  "in_progress",
  "rescheduled",
];
