import type { ChecklistItem } from "./checklist";

export type ReminderStatus = "pending" | "done";

export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  details: string | null;
  checklist: ChecklistItem[];
  action_date: string | null;
  remind_at: string | null;
  mode: "inbox" | "anytime" | "scheduled";
  status: ReminderStatus;
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

export interface CreateReminderInput {
  title: string;
  action_date?: string | null;
  remind_at?: string | null;
  details?: string | null;
  checklist?: ChecklistItem[];
  recurrence_rule?: string | null;
  is_floating?: boolean;
  is_urgent?: boolean;
}

export interface UpdateReminderInput {
  title?: string;
  action_date?: string | null;
  remind_at?: string | null;
  details?: string | null;
  checklist?: ChecklistItem[];
  recurrence_rule?: string | null;
  is_floating?: boolean;
  is_urgent?: boolean;
}
