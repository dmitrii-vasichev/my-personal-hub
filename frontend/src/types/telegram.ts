export interface TelegramAuthStatus {
  connected: boolean;
  phone_number: string | null;
  connected_at: string | null;
}

export interface TelegramConfigStatus {
  configured: boolean;
}

export interface TelegramStartAuthRequest {
  phone_number: string;
}

export interface TelegramVerifyCodeRequest {
  code: string;
  password?: string;
}

export interface TelegramStartAuthResponse {
  ok: boolean;
  detail: string;
  phone_code_hash: string;
  phone_number: string;
}
