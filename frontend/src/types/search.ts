export type SearchProvider = "adzuna" | "serpapi" | "jsearch";

export interface SearchResult {
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  source: string;
  found_at: string | null;
}

export interface SearchRequest {
  query: string;
  location?: string;
  provider: SearchProvider;
  page?: number;
}
