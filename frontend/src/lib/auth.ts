"use client";

import { createContext, useContext } from "react";

export interface User {
  id: number;
  email: string;
  display_name: string;
  role: string;
  must_change_password: boolean;
  is_blocked: boolean;
  theme: string;
  last_login_at: string | null;
  // Telegram→CC bridge (Phase 2): populated by /api/auth/me via
  // user_to_response(); telegram_pin_hash is never exposed — only the
  // derived boolean is.
  telegram_user_id: number | null;
  telegram_pin_configured: boolean;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isDemo: boolean;
  login: (email: string, password: string) => Promise<{ must_change_password: boolean }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
