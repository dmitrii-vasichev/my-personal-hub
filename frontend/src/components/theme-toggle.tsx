"use client";

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
      className="inline-flex items-center h-7 px-[10px] border border-[color:var(--line)] bg-transparent text-[10.5px] tracking-[0.5px] uppercase text-[color:var(--ink-2)] hover:text-[color:var(--ink)] hover:border-[color:var(--ink)] transition-colors"
    >
      ◐ THEME
    </button>
  );
}
