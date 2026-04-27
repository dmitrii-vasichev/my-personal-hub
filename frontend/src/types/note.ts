export interface NoteTreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  google_file_id: string;
  children?: NoteTreeNode[];
}

export interface NoteTreeResponse {
  folder_id: string;
  tree: NoteTreeNode[];
}

export interface Note {
  id: number;
  user_id: number;
  google_file_id: string | null;
  title: string;
  folder_path: string | null;
  mime_type: string | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedNoteBrief {
  id: number;
  title: string;
  folder_path: string | null;
  google_file_id: string | null;
  file_id?: string;
}
