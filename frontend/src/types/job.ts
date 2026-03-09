// Application pipeline status
export type ApplicationStatus =
  | "found"
  | "saved"
  | "resume_generated"
  | "applied"
  | "screening"
  | "technical_interview"
  | "final_interview"
  | "offer"
  | "accepted"
  | "rejected"
  | "ghosted"
  | "withdrawn";

// Minimal summary types used as nested fields
export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location?: string;
}

export interface ApplicationSummary {
  id: number;
  status: ApplicationStatus;
  applied_date?: string;
}

// Main entities
export interface Job {
  id: number;
  user_id: number;
  title: string;
  company: string;
  location?: string;
  url?: string;
  source: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency: string;
  match_score?: number;
  tags: string[];
  found_at?: string;
  created_at: string;
  updated_at: string;
  application?: ApplicationSummary; // linked application if exists
}

export interface StatusHistoryEntry {
  id: number;
  application_id: number;
  old_status?: string;
  new_status: string;
  comment?: string;
  changed_at: string;
}

export interface Application {
  id: number;
  user_id: number;
  job_id: number;
  status: ApplicationStatus;
  notes?: string;
  recruiter_name?: string;
  recruiter_contact?: string;
  applied_date?: string;
  next_action?: string;
  next_action_date?: string;
  rejection_reason?: string;
  job?: JobSummary;
  status_history?: StatusHistoryEntry[];
  created_at: string;
  updated_at: string;
}

// Kanban card — lighter than full Application, used for board view
export interface KanbanCard {
  id: number;
  job_id: number;
  status: ApplicationStatus;
  applied_date?: string;
  next_action?: string;
  next_action_date?: string;
  created_at: string;
  updated_at: string;
  job?: JobSummary;
}

export interface KanbanData {
  found: KanbanCard[];
  saved: KanbanCard[];
  resume_generated: KanbanCard[];
  applied: KanbanCard[];
  screening: KanbanCard[];
  technical_interview: KanbanCard[];
  final_interview: KanbanCard[];
  offer: KanbanCard[];
  accepted: KanbanCard[];
  rejected: KanbanCard[];
  ghosted: KanbanCard[];
  withdrawn: KanbanCard[];
}

// Human-readable labels for all 12 statuses
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  found: "Found",
  saved: "Saved",
  resume_generated: "Resume Generated",
  applied: "Applied",
  screening: "Screening",
  technical_interview: "Technical Interview",
  final_interview: "Final Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

// Color tokens for status badges
// accent: #4f8ef7, danger: #f87171, warning: #fbbf24, success: #34d399
// text-tertiary: #4b5563, orange: #fb923c
export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  found: "#4b5563", // text-tertiary (neutral)
  saved: "#4f8ef7", // accent
  resume_generated: "#4f8ef7", // accent
  applied: "#4f8ef7", // accent
  screening: "#fbbf24", // warning
  technical_interview: "#fb923c", // orange
  final_interview: "#fb923c", // orange
  offer: "#34d399", // success
  accepted: "#34d399", // success
  rejected: "#f87171", // danger
  ghosted: "#4b5563", // text-tertiary (neutral)
  withdrawn: "#4b5563", // text-tertiary (neutral)
};

// Ordered pipeline columns for Kanban (excludes terminal statuses)
export const PIPELINE_COLUMNS: ApplicationStatus[] = [
  "found",
  "saved",
  "resume_generated",
  "applied",
  "screening",
  "technical_interview",
  "final_interview",
  "offer",
];

// Terminal statuses — shown separately or in archive
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
];

// Input types for create/update operations
export interface CreateJobInput {
  title: string;
  company: string;
  location?: string;
  url?: string;
  source?: string;
  description?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  match_score?: number;
  tags?: string[];
  found_at?: string;
}

export interface UpdateJobInput {
  title?: string;
  company?: string;
  location?: string | null; // null to clear
  url?: string | null;
  source?: string;
  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  match_score?: number | null;
  tags?: string[];
  found_at?: string | null;
}

export interface CreateApplicationInput {
  job_id: number;
  status?: ApplicationStatus;
}

export interface UpdateApplicationInput {
  notes?: string | null;
  recruiter_name?: string | null;
  recruiter_contact?: string | null;
  applied_date?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  rejection_reason?: string | null;
}

export interface ChangeStatusInput {
  new_status: ApplicationStatus;
  comment?: string;
}

export interface JobFilters {
  search?: string;
  company?: string;
  source?: string;
  has_application?: boolean;
  tags?: string;
  sort_by?: "created_at" | "company" | "match_score";
  sort_order?: "asc" | "desc";
}

export interface ApplicationFilters {
  status?: string;
  search?: string;
  sort_by?: "created_at" | "updated_at" | "applied_date" | "next_action_date";
  sort_order?: "asc" | "desc";
}
