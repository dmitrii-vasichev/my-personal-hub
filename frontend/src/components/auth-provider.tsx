"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { AuthContext, type User } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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
    const data = await api.post<{
      access_token: string;
      must_change_password: boolean;
    }>("/api/auth/login", { email, password });

    localStorage.setItem("access_token", data.access_token);

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
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
