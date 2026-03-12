export interface TagBrief {
  id: number;
  name: string;
  color: string;
}

export interface Tag extends TagBrief {
  task_count: number;
  created_at: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  color?: string;
}

export interface BulkTagRequest {
  task_ids: number[];
  add_tag_ids?: number[];
  remove_tag_ids?: number[];
}

export interface BulkTagResponse {
  affected_tasks: number;
}

export const TAG_PRESET_COLORS = [
  { hex: "#4f8ef7", name: "Blue" },
  { hex: "#2dd4bf", name: "Teal" },
  { hex: "#a78bfa", name: "Violet" },
  { hex: "#fbbf24", name: "Amber" },
  { hex: "#f87171", name: "Red" },
  { hex: "#34d399", name: "Green" },
  { hex: "#f472b6", name: "Pink" },
  { hex: "#fb923c", name: "Orange" },
] as const;
