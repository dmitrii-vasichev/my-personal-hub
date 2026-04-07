export interface PulseSettings {
  id: number;
  user_id: number;
  polling_interval_minutes: number;
  digest_schedule: string;
  digest_time: string;
  timezone: string;
  digest_day: number | null;
  digest_interval_days: number | null;
  message_ttl_days: number;
  poll_message_limit: number;
  bot_token_set: boolean;
  bot_chat_id: number | null;
  notify_digest_ready: boolean;
  notify_urgent_jobs: boolean;
  prompt_news: string | null;
  prompt_jobs: string | null;
  prompt_learning: string | null;
  reminder_repeat_count: number;
  reminder_repeat_interval: number;
  reminder_snooze_limit: number;
  updated_at: string;
}

export interface PulseSettingsUpdate {
  polling_interval_minutes?: number;
  digest_schedule?: string;
  digest_time?: string;
  timezone?: string;
  digest_day?: number;
  digest_interval_days?: number;
  message_ttl_days?: number;
  poll_message_limit?: number;
  bot_token?: string;
  bot_chat_id?: number;
  notify_digest_ready?: boolean;
  notify_urgent_jobs?: boolean;
  prompt_news?: string | null;
  prompt_jobs?: string | null;
  prompt_learning?: string | null;
  reminder_repeat_count?: number;
  reminder_repeat_interval?: number;
  reminder_snooze_limit?: number;
}
