export type ReminderStatus = "pending" | "done";

export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  remind_at: string;
  status: ReminderStatus;
  snoozed_until: string | null;
  recurrence_rule: string | null;
  snooze_count: number;
  notification_sent_count: number;
  task_id: number | null;
  task_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  title: string;
  remind_at: string;
  recurrence_rule?: string | null;
  task_id?: number;
}

export interface UpdateReminderInput {
  title?: string;
  remind_at?: string;
  recurrence_rule?: string | null;
}
