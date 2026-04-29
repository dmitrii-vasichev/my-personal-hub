import type { ChecklistItem } from "./checklist";

export type ActionStatus = "pending" | "done";
export type ActionMode = "inbox" | "anytime" | "scheduled";

export interface Action {
  id: number;
  user_id: number;
  title: string;
  details: string | null;
  checklist: ChecklistItem[];
  action_date: string | null;
  remind_at: string | null;
  mode: ActionMode;
  status: ActionStatus;
  snoozed_until: string | null;
  recurrence_rule: string | null;
  snooze_count: number;
  notification_sent_count: number;
  completed_at: string | null;
  is_floating: boolean;
  is_urgent: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateActionInput {
  title: string;
  action_date?: string | null;
  remind_at?: string | null;
  details?: string | null;
  checklist?: ChecklistItem[];
  recurrence_rule?: string | null;
  is_urgent?: boolean;
}

export interface UpdateActionInput {
  title?: string;
  action_date?: string | null;
  remind_at?: string | null;
  details?: string | null;
  checklist?: ChecklistItem[];
  recurrence_rule?: string | null;
  is_urgent?: boolean;
}
