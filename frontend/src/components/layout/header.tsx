"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";

interface HeaderProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Today",
  "/tasks": "Tasks",
  "/reminders": "Reminders",
  "/calendar": "Meetings",
  "/jobs": "Job Hunt",
  "/outreach": "Outreach",
  "/notes": "Notes",
  "/pulse": "Pulse",
  "/vitals": "Vitals",
  "/settings": "Settings",
  "/profile": "Profile",
};

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.keys(PAGE_TITLES)
    .filter((p) => p !== "/" && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLES[match] : "Hub";
}

function isoWeek(d: Date): number {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatStamp(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const year = String(d.getFullYear()).slice(-2);
  const week = `W${isoWeek(d)}`;
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${weekday} ${day} ${month} ${year} · ${week} · ${hours}:${minutes}`;
}

function useLiveStamp(): string {
  const [stamp, setStamp] = useState<string>("");
  useEffect(() => {
    const tick = () => setStamp(formatStamp(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return stamp;
}

export function Header({ onMenuToggle, showMenuButton }: HeaderProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const title = pageTitleFor(pathname);
  const stamp = useLiveStamp();

  return (
    <header className="flex h-11 items-center border-b border-[color:var(--line)] bg-[color:var(--bg)] px-5 gap-4 text-[11px] tracking-[0.5px] text-[color:var(--ink-3)]">
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="md:hidden inline-flex items-center justify-center w-7 h-7 border border-[color:var(--line)] text-[color:var(--ink-2)] hover:text-[color:var(--ink)] hover:border-[color:var(--ink)]"
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className="flex items-center gap-2 uppercase">
          <span>HUB</span>
          <span className="text-[color:var(--ink-4)]">/</span>
          <b className="text-[color:var(--ink)] font-medium">{title}</b>
        </div>
      </div>

      <div className="flex-1" />

      <div className="hidden sm:flex items-center gap-4">
        <span className="flex items-center gap-[5px] uppercase">
          <span
            className="inline-block w-[5px] h-[5px] rounded-full bg-[color:var(--accent)]"
            aria-hidden
          />
          {stamp}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <>
            <Tooltip content="View profile">
              <Link
                href="/profile"
                className="hover:opacity-80 transition-opacity"
              >
                <Avatar name={user.display_name} size="sm" />
              </Link>
            </Tooltip>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center w-7 h-7 border border-[color:var(--line)] text-[color:var(--ink-2)] hover:text-[color:var(--ink)] hover:border-[color:var(--ink)]"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
