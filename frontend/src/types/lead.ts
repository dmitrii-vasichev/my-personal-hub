// Lead outreach status
export type LeadStatus =
  | "new"
  | "sent"
  | "replied"
  | "in_progress"
  | "rejected"
  | "on_hold";

export interface LeadStatusHistoryEntry {
  id: number;
  lead_id: number;
  old_status?: string;
  new_status: string;
  comment?: string;
  changed_at: string;
}

export interface Industry {
  id: number;
  user_id: number;
  name: string;
  slug: string;
  drive_file_id?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: number;
  user_id: number;
  business_name: string;
  industry_id?: number;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  service_description?: string;
  source: string;
  source_detail?: string;
  status: LeadStatus;
  notes?: string;
  proposal_text?: string;
  status_history?: LeadStatusHistoryEntry[];
  industry?: Industry;
  created_at: string;
  updated_at: string;
}

// Kanban card — lighter view
export interface LeadKanbanCard {
  id: number;
  business_name: string;
  contact_person?: string;
  industry_id?: number;
  status: LeadStatus;
  email?: string;
  phone?: string;
  updated_at: string;
}

export interface LeadKanbanData {
  new: LeadKanbanCard[];
  sent: LeadKanbanCard[];
  replied: LeadKanbanCard[];
  in_progress: LeadKanbanCard[];
  rejected: LeadKanbanCard[];
  on_hold: LeadKanbanCard[];
}

// Human-readable labels
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  sent: "Sent",
  replied: "Replied",
  in_progress: "In Progress",
  rejected: "Rejected",
  on_hold: "On Hold",
};

// Theme-aware status colors
export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "var(--tertiary)",
  sent: "var(--primary)",
  replied: "var(--accent-amber)",
  in_progress: "var(--accent-teal)",
  rejected: "var(--destructive)",
  on_hold: "var(--tertiary)",
};

export const LEAD_STATUS_BG_COLORS: Record<LeadStatus, string> = {
  new: "var(--muted)",
  sent: "var(--accent-muted)",
  replied: "var(--accent-amber-muted)",
  in_progress: "var(--accent-teal-muted)",
  rejected: "var(--destructive-muted)",
  on_hold: "var(--muted)",
};

// Pipeline columns for kanban
export const LEAD_PIPELINE_COLUMNS: LeadStatus[] = [
  "new",
  "sent",
  "replied",
  "in_progress",
];

export const LEAD_TERMINAL_STATUSES: LeadStatus[] = [
  "rejected",
  "on_hold",
];

// Input types
export interface CreateLeadInput {
  business_name: string;
  industry_id?: number;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  service_description?: string;
  source?: string;
  source_detail?: string;
  notes?: string;
}

export interface UpdateLeadInput {
  business_name?: string;
  industry_id?: number | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  service_description?: string | null;
  source?: string;
  source_detail?: string | null;
  notes?: string | null;
  proposal_text?: string | null;
}

export interface ChangeLeadStatusInput {
  new_status: LeadStatus;
  comment?: string;
}

export interface LeadFilters {
  search?: string;
  status?: string;
  industry_id?: number;
  source?: string;
  sort_by?: "created_at" | "updated_at" | "business_name" | "status";
  sort_order?: "asc" | "desc";
}

// PDF parsing
export interface ParsedLead {
  business_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  website?: string;
  service_description?: string;
  industry_suggestion?: string;
  page: number;
}

export interface PdfParseError {
  page: number;
  error: string;
}

export interface PdfParseResponse {
  total_pages: number;
  leads: ParsedLead[];
  errors: PdfParseError[];
}

// Proposal generation
export interface GenerateProposalInput {
  custom_instructions?: string;
}

export interface CreateIndustryInput {
  name: string;
  slug: string;
  drive_file_id?: string;
  description?: string;
}

export interface UpdateIndustryInput {
  name?: string;
  slug?: string;
  drive_file_id?: string | null;
  description?: string | null;
}
