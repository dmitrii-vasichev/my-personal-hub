export interface PulseDigest {
  id: number;
  user_id: number;
  category: string | null;
  content: string | null;
  digest_type: string;
  message_count: number;
  items_count: number | null;
  generated_at: string;
  period_start: string | null;
  period_end: string | null;
}

export interface DigestListResponse {
  items: PulseDigest[];
  total: number;
}

export interface DigestGenerateRequest {
  category?: string;
}

export interface DigestGenerateResponse {
  digest: PulseDigest | null;
  message: string;
}

export interface PreviewItem {
  title: string;
  classification: string | null;
}

export interface DigestSummaryItem {
  id: number;
  category: string | null;
  content_preview: string;
  message_count: number;
  items_count: number | null;
  generated_at: string;
  preview_items: PreviewItem[];
}

export interface PulseSummaryResponse {
  digests: DigestSummaryItem[];
  period_start: string | null;
  period_end: string | null;
}

// --- Digest Items (structured digests) ---

export interface DigestItem {
  id: number;
  digest_id: number;
  title: string;
  summary: string;
  classification: string;
  metadata: Record<string, string | null> | null;
  source_names: string[] | null;
  status: "new" | "actioned" | "skipped";
  read_at: string | null;
  is_read: boolean;
  action_type: string | null;
  action_result_id: number | null;
  created_at: string;
}

export interface DigestItemListResponse {
  items: DigestItem[];
  total: number;
  is_markdown: boolean;
}

export type DigestItemAction = "to_task" | "to_note" | "to_job" | "skip";

export interface DigestItemBulkActionRequest {
  item_ids: number[];
  action: DigestItemAction;
}

export interface PulseUnreadCountResponse {
  unread_count: number;
}
