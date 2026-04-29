export interface TaskLinkedReminderReviewItem {
  task_id: number;
  task_title: string;
  reminder_id: number;
  reminder_title: string;
  action_date: string | null;
  remind_at: string | null;
  is_urgent: boolean;
  recurrence_rule: string | null;
  details: string | null;
  checklist_count: number;
}

export interface PreserveTaskLinkedRemindersResponse {
  preserved_count: number;
  reminder_ids: number[];
}
