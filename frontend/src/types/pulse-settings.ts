export interface PulseSettings {
  id: number;
  user_id: number;
  polling_interval_minutes: number;
  digest_schedule: string;
  digest_time: string;
  digest_day: number | null;
  digest_interval_days: number | null;
  message_ttl_days: number;
  notify_digest_ready: boolean;
  notify_urgent_jobs: boolean;
  updated_at: string;
}

export interface PulseSettingsUpdate {
  polling_interval_minutes?: number;
  digest_schedule?: string;
  digest_time?: string;
  digest_day?: number;
  digest_interval_days?: number;
  message_ttl_days?: number;
  notify_digest_ready?: boolean;
  notify_urgent_jobs?: boolean;
}
