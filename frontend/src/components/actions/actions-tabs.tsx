"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useActions } from "@/hooks/use-actions";
import { isInboxAction } from "./action-filters";

export function ActionsTabs() {
  const pathname = usePathname();
  const { data: actions = [] } = useActions();
  const inboxCount = actions.filter(isInboxAction).length;
  const tabs = [
    { label: "Actions", href: "/actions" },
    { label: `Inbox (${inboxCount})`, href: "/actions/inbox" },
    { label: "Birthdays", href: "/actions/birthdays" },
  ] as const;

  return (
    <nav
      role="tablist"
      className="flex items-center gap-0 border-b-[1.5px] border-[color:var(--line)]"
    >
      {tabs.map((tab) => {
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
