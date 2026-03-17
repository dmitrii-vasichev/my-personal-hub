export interface PulseSource {
  id: number;
  user_id: number;
  telegram_id: number;
  username: string | null;
  title: string;
  category: string;
  subcategory: string | null;
  keywords: string[] | null;
  criteria: Record<string, unknown> | null;
  is_active: boolean;
  last_polled_at: string | null;
  poll_status: "idle" | "polling" | "error";
  last_poll_error: string | null;
  last_poll_message_count: number;
  created_at: string;
}

export interface PollStatusSource {
  id: number;
  title: string;
  poll_status: "idle" | "polling" | "error";
  last_poll_error: string | null;
  last_poll_message_count: number;
  last_polled_at: string | null;
}

export interface PollStatusResponse {
  sources: PollStatusSource[];
  any_polling: boolean;
}

export interface PulseSourceCreate {
  telegram_id: number;
  username?: string;
  title: string;
  category: string;
  subcategory?: string;
  keywords?: string[];
  criteria?: Record<string, unknown>;
}

export interface PulseSourceUpdate {
  title?: string;
  category?: string;
  subcategory?: string;
  keywords?: string[];
  criteria?: Record<string, unknown>;
  is_active?: boolean;
}

export interface PulseSourceResolveResult {
  telegram_id: number;
  username: string | null;
  title: string;
  members_count: number | null;
}

export const SOURCE_CATEGORIES = ["news", "jobs", "learning"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  news: "News",
  jobs: "Jobs",
  learning: "Learning",
};
