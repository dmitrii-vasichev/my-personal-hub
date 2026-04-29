"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckSquare,
  Calendar,
  Briefcase,
  StickyNote,
  Radio,
  Heart,
  Github,
  Linkedin,
  Send,
} from "lucide-react";

const MODULES = [
  { icon: CheckSquare, label: "Actions", color: "#4f8ef7" },
  { icon: Calendar, label: "Calendar", color: "#2dd4bf" },
  { icon: Briefcase, label: "Jobs", color: "#a78bfa" },
  { icon: StickyNote, label: "Notes", color: "#fbbf24" },
  { icon: Radio, label: "Pulse", color: "#f87171" },
  { icon: Heart, label: "Vitals", color: "#34d399" },
];

const SOCIAL_LINKS = [
  {
    icon: Github,
    href: "https://github.com/dmitrii-vasichev",
    label: "GitHub",
  },
  {
    icon: Linkedin,
    href: "https://linkedin.com/in/dmitrii-vasichev",
    label: "LinkedIn",
  },
  {
    icon: Send,
    href: "https://t.me/dmitrii_vasichev",
    label: "Telegram",
  },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError("");
    setDemoLoading(true);

    try {
      const resp = await fetch("/api/auth/demo-login", { method: "POST" });
      if (!resp.ok) {
        throw new Error("Demo login failed");
      }
      const data: { access_token: string } = await resp.json();
      localStorage.setItem("access_token", data.access_token);
      queryClient.clear();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen">
      {/* Left panel — showcase */}
      <div className="login-left-panel relative hidden w-1/2 flex-col justify-between overflow-hidden p-10 md:flex lg:p-14">
        {/* Decorative dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--text-tertiary) 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
            opacity: 0.15,
          }}
        />

        {/* Gradient overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, rgba(79,142,247,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(45,212,191,0.06) 0%, transparent 60%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col">
          {/* Header — title + tagline */}
          <div
            className="mb-12"
            style={{
              animation: "fadeSlideUp 0.5s ease forwards",
              opacity: 0,
            }}
          >
            <h1
              className="mb-2 text-[28px] font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              Personal Hub
            </h1>
            <p
              className="text-[15px]"
              style={{ color: "var(--text-secondary)" }}
            >
              All-in-one productivity dashboard
            </p>
          </div>

          {/* Module grid */}
          <div
            className="mb-10 grid grid-cols-2 gap-3"
            style={{
              animation: "fadeSlideUp 0.5s ease 0.1s forwards",
              opacity: 0,
            }}
          >
            {MODULES.map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
                style={{
                  background: `${color}08`,
                }}
              >
                <Icon
                  size={16}
                  style={{ color }}
                />
                <span
                  className="text-[13px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Demo button */}
          <div
            style={{
              animation: "fadeSlideUp 0.5s ease 0.2s forwards",
              opacity: 0,
            }}
          >
            <Button
              variant="outline"
              className="h-10 w-full cursor-pointer text-[13.5px]"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              data-testid="demo-login-btn"
            >
              {demoLoading ? "Loading..." : "Explore Demo"}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="relative z-10 space-y-3"
          style={{
            animation: "fadeSlideUp 0.5s ease 0.3s forwards",
            opacity: 0,
          }}
        >
          <p
            className="text-[13px]"
            style={{ color: "var(--text-secondary)" }}
          >
            Built by{" "}
            <a
              href="https://dmitrii-vasichev.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-transparent underline-offset-2 transition-all duration-150"
              style={{ color: "var(--text-primary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-hover)";
                e.currentTarget.style.textDecorationColor = "var(--accent-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.textDecorationColor = "transparent";
              }}
            >
              Dmitrii Vasichev
            </a>
          </p>
          <p
            className="font-mono text-[11px] tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Next.js · FastAPI · PostgreSQL
          </p>
          <div className="flex gap-3">
            {SOCIAL_LINKS.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="rounded-md p-2 transition-colors duration-150"
                style={{ color: "var(--text-tertiary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--text-primary)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--text-tertiary)")
                }
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div
        className="flex w-full flex-col items-center justify-center px-6 md:w-1/2"
        style={{ background: "var(--surface)" }}
      >
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Sign in
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* "or try demo" link */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={demoLoading}
              className="cursor-pointer text-[13px] transition-colors duration-150"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-secondary)")
              }
              data-testid="demo-try-link"
            >
              {demoLoading ? "Loading..." : "or try demo →"}
            </button>
          </div>

          {/* Mobile-only: product info */}
          <div
            className="mt-12 text-center md:hidden"
            style={{ color: "var(--text-secondary)" }}
          >
            <p className="text-[12px]">
              Personal Hub — All-in-one productivity dashboard
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
