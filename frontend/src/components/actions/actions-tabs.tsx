"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Actions", href: "/actions" },
  { label: "Birthdays", href: "/actions/birthdays" },
] as const;

export function ActionsTabs() {
  const pathname = usePathname();

  return (
    <nav
      role="tablist"
      className="flex items-center gap-0 border-b-[1.5px] border-[color:var(--line)]"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "px-4 py-1.5 -mb-[1.5px] border-b-2 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors sm:py-2 sm:border-b-[3px]",
              isActive
                ? "border-[color:var(--accent)] text-[color:var(--ink)] font-bold"
                : "border-transparent text-[color:var(--ink-3)] hover:text-[color:var(--ink)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
