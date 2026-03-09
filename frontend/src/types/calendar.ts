export type EventSource = "local" | "google";

export interface CalendarEvent {
  id: number;
  user_id: number;
  google_event_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  all_day: boolean;
  source: EventSource;
  synced_at: string | null;
  notes_count: number;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventDetail extends CalendarEvent {
  notes: EventNote[];
}

export interface EventNote {
  id: number;
  event_id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface GoogleOAuthStatus {
  connected: boolean;
  calendar_id: string | null;
  last_synced: string | null;
}

export interface CalendarEventCreate {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  all_day?: boolean;
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  all_day?: boolean;
}

export interface EventNoteCreate {
  content: string;
}

export interface CalendarFilters {
  start?: string;
  end?: string;
}
