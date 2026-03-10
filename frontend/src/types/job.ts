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

// Match result from AI job matching
export interface MatchResult {
  score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  recommendations: string[];
}

// Brief types for linked items display
export interface LinkedTaskBrief {
  id: number;
  title: string;
  status: string;
  priority: string;
}

export interface LinkedEventBrief {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
}

// Status history entry — now linked to job directly
export interface StatusHistoryEntry {
  id: number;
  job_id: number;
  old_status?: string;
  new_status: string;
  comment?: string;
  changed_at: string;
}

// Main Job entity — unified with tracking fields (formerly split between Job + Application)
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
  match_result?: MatchResult;
  tags: string[];
  found_at?: string;
  created_at: string;
  updated_at: string;
  // Tracking fields (formerly on Application)
  status?: ApplicationStatus;
  notes?: string;
  recruiter_name?: string;
  recruiter_contact?: string;
  applied_date?: string;
  next_action?: string;
  next_action_date?: string;
  rejection_reason?: string;
  status_history?: StatusHistoryEntry[];
}

// Kanban card — lighter view of Job for board display
export interface KanbanCard {
  id: number;
  status: ApplicationStatus;
  title: string;
  company: string;
  location?: string;
  match_score?: number;
  applied_date?: string;
  next_action?: string;
  next_action_date?: string;
  created_at: string;
  updated_at: string;
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

// CSS variable references — theme-aware status colors
export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  found: "var(--tertiary)",
  saved: "var(--primary)",
  resume_generated: "var(--primary)",
  applied: "var(--primary)",
  screening: "var(--accent-amber)",
  technical_interview: "var(--accent-amber)",
  final_interview: "var(--accent-amber)",
  offer: "var(--accent-teal)",
  accepted: "var(--accent-teal)",
  rejected: "var(--destructive)",
  ghosted: "var(--tertiary)",
  withdrawn: "var(--tertiary)",
};

// Muted background variants for status badges (used as inline style backgroundColor)
export const APPLICATION_STATUS_BG_COLORS: Record<ApplicationStatus, string> = {
  found: "var(--muted)",
  saved: "var(--accent-muted)",
  resume_generated: "var(--accent-muted)",
  applied: "var(--accent-muted)",
  screening: "var(--accent-amber-muted)",
  technical_interview: "var(--accent-amber-muted)",
  final_interview: "var(--accent-amber-muted)",
  offer: "var(--accent-teal-muted)",
  accepted: "var(--accent-teal-muted)",
  rejected: "var(--destructive-muted)",
  ghosted: "var(--muted)",
  withdrawn: "var(--muted)",
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
  location?: string | null;
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

export interface UpdateJobTrackingInput {
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
  status?: string;
  tags?: string;
  sort_by?: "created_at" | "company" | "match_score" | "title" | "source" | "found_at";
  sort_order?: "asc" | "desc";
}
