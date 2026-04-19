// Request bodies for the Telegram→Claude-Code bridge self-service
// endpoints. Both PUTs respond with 204 No Content, so no response types
// are needed here.

export interface UpdateTelegramUserIdRequest {
  telegram_user_id: number;
}

export interface UpdateTelegramPinRequest {
  pin: string;
}
