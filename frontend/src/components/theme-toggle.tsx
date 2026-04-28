"use client";

import { SunMoon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
      aria-label="Toggle theme"
      className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--line)] bg-transparent text-[10.5px] tracking-[0.5px] uppercase text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--ink)] hover:text-[color:var(--ink)] md:h-7 md:w-auto md:px-[10px]"
    >
      <SunMoon className="h-4 w-4 md:hidden" />
      <span className="hidden md:inline">◐ THEME</span>
    </button>
  );
}
