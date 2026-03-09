export type TaskStatus = "new" | "in_progress" | "review" | "done" | "cancelled";
export type TaskPriority = "urgent" | "high" | "medium" | "low";
export type Visibility = "family" | "private";
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
  visibility: Visibility;
  deadline: string | null;
  reminder_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: UserBrief;
  assignee?: UserBrief;
  owner_name?: string;
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
  visibility?: Visibility;
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
  visibility?: Visibility;
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
  urgent: "text-destructive",
  high: "text-accent-amber",
  medium: "text-warning",
  low: "text-tertiary",
};

export const PRIORITY_BG_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-destructive-muted text-destructive",
  high: "bg-accent-amber-muted text-accent-amber",
  medium: "bg-accent-amber-muted text-warning",
  low: "bg-surface-hover text-tertiary",
};
