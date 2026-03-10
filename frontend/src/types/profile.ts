export interface SkillEntry {
  name: string;
  level?: string;
  years?: number;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  year?: number;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  linkedin?: string;
  location?: string;
}

export interface UserProfile {
  id: number;
  user_id: number;
  summary: string | null;
  skills: SkillEntry[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  contacts: ContactInfo;
  raw_import: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateInput {
  summary?: string;
  skills?: SkillEntry[];
  experience?: ExperienceEntry[];
  education?: EducationEntry[];
  contacts?: ContactInfo;
}

export interface ProfileImportInput {
  text: string;
}
