export interface ApiTokenListItem {
  id: number;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiTokenCreateResponse extends ApiTokenListItem {
  raw_token: string;
}
