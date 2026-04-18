export interface UserListItem {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "member" | "demo";
  must_change_password: boolean;
  is_blocked: boolean;
  theme: string;
  last_login_at: string | null;
}

export interface CreateUserInput {
  email: string;
  display_name: string;
  role?: "admin" | "member";
}

export interface UpdateUserInput {
  role?: "admin" | "member";
  is_blocked?: boolean;
}

export interface UpdateProfileInput {
  display_name?: string;
  theme?: "light" | "dark";
  timezone?: string;
}

export interface ResetPasswordResponse {
  temporary_password: string;
  must_change_password: boolean;
}

export interface CreateUserResponse {
  id: number;
  email: string;
  display_name: string;
  role: string;
  temporary_password: string;
}

export interface ProfileResponse {
  id: number;
  email: string;
  display_name: string;
  role: "admin" | "member" | "demo";
  theme: string;
  timezone: string;
  is_blocked: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
}
