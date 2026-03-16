export interface PulseDigest {
  id: number;
  user_id: number;
  category: string | null;
  content: string;
  message_count: number;
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
