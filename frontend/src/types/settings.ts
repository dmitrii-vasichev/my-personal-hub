export interface UserSettings {
  id: number;
  user_id: number;
  default_location: string | null;
  target_roles: string[];
  min_match_score: number;
  excluded_companies: string[];
  stale_threshold_days: number;
  llm_provider: "openai" | "anthropic" | "gemini";
  has_api_key_openai: boolean;
  has_api_key_anthropic: boolean;
  has_api_key_gemini: boolean;
  has_api_key_adzuna: boolean;
  has_api_key_serpapi: boolean;
  has_api_key_jsearch: boolean;
  has_google_client_id: boolean;
  has_google_client_secret: boolean;
  google_redirect_uri: string | null;
  google_drive_notes_folder_id: string | null;
  instruction_resume: string | null;
  instruction_ats_audit: string | null;
  instruction_gap_analysis: string | null;
  instruction_cover_letter: string | null;
  kanban_hidden_columns: string[];
  updated_at: string;
}

export interface UpdateSettingsInput {
  default_location?: string;
  target_roles?: string[];
  min_match_score?: number;
  excluded_companies?: string[];
  stale_threshold_days?: number;
  llm_provider?: string;
  api_key_openai?: string;
  api_key_anthropic?: string;
  api_key_gemini?: string;
  api_key_adzuna_id?: string;
  api_key_adzuna_key?: string;
  api_key_serpapi?: string;
  api_key_jsearch?: string;
  google_client_id?: string;
  google_client_secret?: string;
  google_redirect_uri?: string;
  google_drive_notes_folder_id?: string;
  instruction_resume?: string;
  instruction_ats_audit?: string;
  instruction_gap_analysis?: string;
  instruction_cover_letter?: string;
  kanban_hidden_columns?: string[];
}
