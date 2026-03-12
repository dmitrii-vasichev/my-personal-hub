export type TaskStatus = "backlog" | "new" | "in_progress" | "review" | "done" | "cancelled";
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
  kanban_order: number;
  created_at: string;
  updated_at: string;
  creator?: UserBrief;
  assignee?: UserBrief;
  owner_name?: string;
  tags: import("./tag").TagBrief[];
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
  backlog: Task[];
  new: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
  cancelled: Task[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: string;
  reminder_at?: string;
  checklist?: ChecklistItem[];
  assignee_id?: number;
  visibility?: Visibility;
  tag_ids?: number[];
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
  tag_ids?: number[];
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
  tag_id?: number;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  new: "New",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "new",
  "in_progress",
  "review",
  "done",
  "cancelled",
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "text-destructive",
  high: "text-accent-amber",
  medium: "text-accent-foreground",
  low: "text-tertiary",
};

export const PRIORITY_BG_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-destructive-muted text-destructive",
  high: "bg-accent-amber-muted text-accent-amber",
  medium: "bg-accent-muted text-accent-foreground",
  low: "bg-surface-hover text-tertiary",
};

export const PRIORITY_DOT_COLORS: Record<TaskPriority, string> = {
  urgent: "bg-destructive",
  high: "bg-accent-amber",
  medium: "bg-accent-foreground",
  low: "bg-tertiary",
};

export const PRIORITY_BORDER_COLORS: Record<TaskPriority, string> = {
  urgent: "border-l-destructive",
  high: "border-l-[var(--accent-amber)]",
  medium: "border-l-primary",
  low: "border-l-[var(--text-tertiary)]",
};

export const PRIORITY_BORDER_CSS_VARS: Record<TaskPriority, string> = {
  urgent: "var(--destructive)",
  high: "var(--accent-amber)",
  medium: "var(--primary)",
  low: "var(--text-tertiary)",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const DEFAULT_HIDDEN_COLUMNS: TaskStatus[] = ["review", "cancelled"];
