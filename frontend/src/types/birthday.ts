export interface Birthday {
  id: number;
  user_id: number;
  name: string;
  birth_date: string;
  birth_year: number | null;
  advance_days: number;
  reminder_time: string;
  next_birthday: string;
  days_until: number;
  turning_age: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBirthdayInput {
  name: string;
  birth_date: string;
  birth_year?: number | null;
  advance_days?: number;
  reminder_time?: string;
}

export interface UpdateBirthdayInput {
  name?: string;
  birth_date?: string;
  birth_year?: number | null;
  advance_days?: number;
  reminder_time?: string;
}
