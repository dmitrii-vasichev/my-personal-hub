"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPaletteTrigger } from "@/components/command-palette-trigger";
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
    <header className="flex min-h-[calc(44px+var(--safe-top))] shrink-0 items-center gap-2 border-b border-[color:var(--line)] bg-[color:var(--bg)] pl-[max(12px,var(--safe-left))] pr-[max(12px,var(--safe-right))] pt-[var(--safe-top)] text-[11px] tracking-[0.5px] text-[color:var(--ink-3)] max-md:items-end max-md:pb-2 md:min-h-11 md:gap-4 md:px-5 md:pt-0">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuToggle}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--ink)] hover:text-[color:var(--ink)] md:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className="flex min-w-0 items-center gap-2 uppercase">
          <span className="shrink-0">HUB</span>
          <span className="text-[color:var(--ink-4)]">/</span>
          <b className="min-w-0 truncate text-[color:var(--ink)] font-medium">{title}</b>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-4">
        <span className="flex items-center gap-[5px] uppercase">
          <span
            className="inline-block w-[5px] h-[5px] rounded-full bg-[color:var(--accent)]"
            aria-hidden
          />
          {stamp}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
        <CommandPaletteTrigger />
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
              className="hidden h-7 w-7 items-center justify-center border border-[color:var(--line)] text-[color:var(--ink-2)] hover:border-[color:var(--ink)] hover:text-[color:var(--ink)] md:inline-flex"
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
