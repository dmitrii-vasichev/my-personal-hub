export interface InboxItem {
  id: number;
  text: string | null;
  sender_name: string | null;
  message_date: string | null;
  source_title: string | null;
  source_id: number;
  ai_classification: string | null;
  ai_relevance: number | null;
  status: string;
  collected_at: string;
}

export interface InboxListResponse {
  items: InboxItem[];
  total: number;
}

export type InboxAction = "to_task" | "to_note" | "skip";

export interface InboxActionRequest {
  action: InboxAction;
}

export interface BulkActionRequest {
  message_ids: number[];
  action: InboxAction;
}

export interface InboxActionResponse {
  status: string;
  action: string;
  message_id?: number;
  processed?: number;
}
