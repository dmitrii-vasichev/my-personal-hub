export interface VitalsDailyMetric {
  id: number;
  date: string;
  steps: number | null;
  distance_m: number | null;
  calories_active: number | null;
  calories_total: number | null;
  floors_climbed: number | null;
  intensity_minutes: number | null;
  resting_hr: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  min_hr: number | null;
  avg_stress: number | null;
  max_stress: number | null;
  body_battery_high: number | null;
  body_battery_low: number | null;
  vo2_max: number | null;
}

export interface VitalsSleep {
  id: number;
  date: string;
  duration_seconds: number | null;
  deep_seconds: number | null;
  light_seconds: number | null;
  rem_seconds: number | null;
  awake_seconds: number | null;
  sleep_score: number | null;
  start_time: string | null;
  end_time: string | null;
}

export interface VitalsActivity {
  id: number;
  garmin_activity_id: number;
  activity_type: string;
  name: string | null;
  start_time: string;
  duration_seconds: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  calories: number | null;
  avg_pace: string | null;
  elevation_gain: number | null;
}

export interface VitalsBriefing {
  id: number;
  date: string;
  content: string;
  generated_at: string;
}

export interface VitalsTodayResponse {
  metrics: VitalsDailyMetric | null;
  sleep: VitalsSleep | null;
  recent_activities: VitalsActivity[];
}

export interface VitalsConnectionStatus {
  connected: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  sync_interval_minutes: number | null;
  connected_at: string | null;
  rate_limited_until: string | null;
}

export interface VitalsDashboardSummary {
  metrics: VitalsDailyMetric | null;
  sleep: VitalsSleep | null;
  connected: boolean;
  last_sync_at: string | null;
  sync_interval_minutes: number | null;
  briefing_insight: string | null;
  metrics_7d: VitalsDailyMetric[];
  sleep_7d: VitalsSleep[];
}
