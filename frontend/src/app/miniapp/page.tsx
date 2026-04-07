"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { api } from "@/lib/api";

interface MiniAppAuthResponse {
  token: string;
  user_id: number;
  display_name: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme: "light" | "dark";
      };
    };
  }
}

export default function MiniAppPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);

  useEffect(() => {
    if (!sdkLoaded) return;

    const webapp = window.Telegram?.WebApp;
    if (!webapp?.initData) {
      const t = setTimeout(() => setError("Open this page from the Telegram bot menu."), 0);
      return () => clearTimeout(t);
    }

    webapp.ready();
    webapp.expand();

    let cancelled = false;
    api
      .post<MiniAppAuthResponse>("/api/miniapp/auth", {
        init_data: webapp.initData,
      })
      .then((data) => {
        if (cancelled) return;
        localStorage.setItem("access_token", data.token);
        router.replace("/reminders");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Authentication failed");
      });

    return () => { cancelled = true; };
  }, [sdkLoaded, router]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => setSdkLoaded(true)}
      />
      <div className="flex min-h-screen items-center justify-center bg-background">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Connecting...</p>
        )}
      </div>
    </>
  );
}
