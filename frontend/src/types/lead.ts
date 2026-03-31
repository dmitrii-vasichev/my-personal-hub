// Lead outreach status
export type LeadStatus =
  | "new"
  | "contacted"
  | "follow_up"
  | "responded"
  | "negotiating"
  | "won"
  | "lost"
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
  contacted: LeadKanbanCard[];
  follow_up: LeadKanbanCard[];
  responded: LeadKanbanCard[];
  negotiating: LeadKanbanCard[];
  won: LeadKanbanCard[];
  lost: LeadKanbanCard[];
  on_hold: LeadKanbanCard[];
}

// Human-readable labels
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow Up",
  responded: "Responded",
  negotiating: "Negotiating",
  won: "Won",
  lost: "Lost",
  on_hold: "On Hold",
};

// Theme-aware status colors
export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: "var(--tertiary)",
  contacted: "var(--primary)",
  follow_up: "var(--accent-amber)",
  responded: "var(--accent-teal)",
  negotiating: "var(--accent-purple, #8b5cf6)",
  won: "var(--success, #22c55e)",
  lost: "var(--destructive)",
  on_hold: "var(--tertiary)",
};

export const LEAD_STATUS_BG_COLORS: Record<LeadStatus, string> = {
  new: "var(--muted)",
  contacted: "var(--accent-muted)",
  follow_up: "var(--accent-amber-muted)",
  responded: "var(--accent-teal-muted)",
  negotiating: "var(--accent-purple-muted, rgba(139,92,246,0.1))",
  won: "var(--success-muted, rgba(34,197,94,0.1))",
  lost: "var(--destructive-muted)",
  on_hold: "var(--muted)",
};

// Pipeline columns for kanban
export const LEAD_PIPELINE_COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "follow_up",
  "responded",
  "negotiating",
];

export const LEAD_TERMINAL_STATUSES: LeadStatus[] = [
  "won",
  "lost",
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

// Activities
export type ActivityType =
  | "outbound_email"
  | "inbound_email"
  | "proposal_sent"
  | "note"
  | "outbound_call"
  | "inbound_call"
  | "meeting";

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  outbound_email: "Email Sent",
  inbound_email: "Email Received",
  proposal_sent: "Proposal Sent",
  note: "Note",
  outbound_call: "Outbound Call",
  inbound_call: "Inbound Call",
  meeting: "Meeting",
};

export interface LeadActivity {
  id: number;
  lead_id: number;
  activity_type: ActivityType;
  subject?: string;
  body?: string;
  gmail_message_id?: string;
  gmail_thread_id?: string;
  created_at: string;
}

export interface CreateActivityInput {
  activity_type: ActivityType;
  subject?: string;
  body?: string;
}

// Gmail
export interface SendEmailInput {
  subject: string;
  body: string;
}

export interface GmailStatus {
  connected: boolean;
  gmail_available: boolean;
  needs_reauth: boolean;
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

// Analytics
export interface StatusCount {
  status: string;
  count: number;
}

export interface IndustryBreakdown {
  industry_name: string;
  count: number;
}

export interface OutreachAnalytics {
  total: number;
  by_status: StatusCount[];
  by_industry: IndustryBreakdown[];
  conversion_contacted_to_responded: number | null;
  conversion_responded_to_negotiating: number | null;
}

// Duplicate detection
export interface DuplicateMatch {
  field: "email" | "phone";
  value: string;
  existing_lead_id: number;
  existing_business_name: string;
}

export interface CheckDuplicatesInput {
  emails: string[];
  phones: string[];
  exclude_id?: number;
}

export interface CheckDuplicatesResponse {
  duplicates: DuplicateMatch[];
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

// Batch outreach
export type BatchJobStatus =
  | "preparing"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

export type BatchItemStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export interface BatchPrepareInput {
  status?: string[];
  industry_id?: number;
  subject_template?: string;
}

export interface BatchItemPreview {
  lead_id: number;
  business_name: string;
  email?: string;
  industry_name?: string;
  subject: string;
  body: string;
  included: boolean;
}

export interface BatchPrepareResponse {
  job_id: number;
  items: BatchItemPreview[];
  total: number;
  skipped_no_email: number;
  skipped_no_proposal: number;
}

export interface BatchItemUpdate {
  lead_id: number;
  subject?: string;
  body?: string;
  included: boolean;
}

export interface BatchSendInput {
  job_id: number;
  items: BatchItemUpdate[];
}

export interface BatchItemResponse {
  id: number;
  lead_id: number;
  subject: string;
  body: string;
  status: BatchItemStatus;
  error_message?: string;
  sent_at?: string;
  lead_business_name?: string;
}

export interface BatchJobResponse {
  id: number;
  status: BatchJobStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  items: BatchItemResponse[];
  created_at: string;
  updated_at: string;
}
