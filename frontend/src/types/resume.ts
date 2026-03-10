export interface ResumeContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
}

export interface ResumeExperience {
  title: string;
  company: string;
  location?: string;
  start?: string;
  end?: string;
  bullets: string[];
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  year?: string;
}

export interface ResumeJson {
  contact?: ResumeContact;
  summary?: string;
  experience?: ResumeExperience[];
  education?: ResumeEducation[];
  skills?: string[];
  certifications?: string[];
}

export interface AtsAuditResult {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  formatting_issues: string[];
  suggestions: string[];
}

export interface GapAnalysisResult {
  matching_skills: string[];
  missing_skills: string[];
  strengths: string[];
  recommendations: string[];
}

export interface Resume {
  id: number;
  job_id: number;
  version: number;
  resume_json: ResumeJson;
  pdf_url: string | null;
  ats_score: number | null;
  ats_audit_result: AtsAuditResult | null;
  gap_analysis: GapAnalysisResult | null;
  created_at: string;
}

export interface CoverLetter {
  id: number;
  job_id: number;
  version: number;
  content: string;
  created_at: string;
}
