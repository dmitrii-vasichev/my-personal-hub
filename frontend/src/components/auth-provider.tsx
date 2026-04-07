"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AuthContext, type User } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/miniapp"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<User>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("access_token");
      if (!token) {
        if (!PUBLIC_PATHS.includes(pathname)) {
          router.replace("/login");
        }
        return;
      }
      await refreshUser();
    }

    checkAuth().finally(() => setIsLoading(false));
  }, [pathname, refreshUser, router]);

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 403) {
      throw new Error("Account is blocked. Please contact the administrator.");
    }

    if (!response.ok) {
      throw new Error("Invalid email or password");
    }

    const data: { access_token: string; must_change_password: boolean } = await response.json();
    localStorage.setItem("access_token", data.access_token);
    queryClient.clear();

    if (data.must_change_password) {
      router.push("/change-password");
      return { must_change_password: true };
    }

    await refreshUser();
    router.push("/");
    return { must_change_password: false };
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    queryClient.clear();
    setUser(null);
    router.push("/login");
  };

  const isDemo = useMemo(() => user?.role === "demo", [user?.role]);

  return (
    <AuthContext.Provider value={{ user, isLoading, isDemo, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
