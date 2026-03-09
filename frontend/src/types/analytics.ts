export interface FunnelItem {
  status: string;
  count: number;
}

export interface TimelinePoint {
  week: string;
  count: number;
}

export interface SkillItem {
  skill: string;
  count: number;
}

export interface SourceItem {
  source: string | null;
  count: number;
}

export interface AnalyticsSummary {
  total_jobs: number;
  total_applications: number;
  interview_rate: number;
  offer_rate: number;
  avg_ats_score: number | null;
}
