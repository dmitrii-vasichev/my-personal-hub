export interface KBDocument {
  id: number;
  user_id: number;
  slug: string;
  title: string;
  content: string;
  is_default: boolean;
  used_by: string[];
  created_at: string;
  updated_at: string;
}

export interface KBDocumentCreateInput {
  slug: string;
  title: string;
  content: string;
  used_by: string[];
}

export interface KBDocumentUpdateInput {
  title?: string;
  content?: string;
  used_by?: string[];
}
