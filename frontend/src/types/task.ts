export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type UpdateType = "progress" | "status_change" | "comment" | "blocker";

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface UserBrief {
  id: number;
  display_name: string;
  email: string;
}

export interface Task {
  id: number;
  user_id: number;
  created_by_id: number;
  assignee_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  checklist: ChecklistItem[];
  source: string;
  deadline: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: UserBrief;
  assignee?: UserBrief;
}

export interface TaskUpdateItem {
  id: number;
  task_id: number;
  author_id: number;
  type: UpdateType;
  content: string | null;
  old_status: string | null;
  new_status: string | null;
  progress_percent: number | null;
  created_at: string;
  author?: UserBrief;
}

export interface KanbanBoard {
  new: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
  cancelled: Task[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  deadline?: string;
  reminder_at?: string;
  checklist?: ChecklistItem[];
  assignee_id?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string | null;
  reminder_at?: string | null;
  checklist?: ChecklistItem[];
  assignee_id?: number | null;
}

export interface CreateUpdateInput {
  type: UpdateType;
  content?: string;
  progress_percent?: number;
}

export interface TaskFilters {
  status?: string;
  priority?: string;
  assignee_id?: number;
  search?: string;
  deadline_before?: string;
  deadline_after?: string;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "new",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-[var(--text-tertiary)]",
};

export const PRIORITY_BG_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-red-500/15 text-red-400",
  high: "bg-orange-500/15 text-orange-400",
  medium: "bg-yellow-500/15 text-yellow-400",
  low: "bg-[var(--surface-hover)] text-[var(--text-tertiary)]",
};
