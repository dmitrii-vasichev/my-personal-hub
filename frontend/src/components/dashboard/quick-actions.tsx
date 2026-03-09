"use client";

import Link from "next/link";
import { Plus, Briefcase, Calendar, ChevronRight } from "lucide-react";

const actions = [
  {
    label: "Create task",
    href: "/tasks",
    icon: Plus,
    color: "var(--primary)",
    colorMuted: "var(--accent-muted)",
  },
  {
    label: "Log application",
    href: "/jobs",
    icon: Briefcase,
    color: "var(--accent-teal)",
    colorMuted: "var(--accent-teal-muted)",
  },
  {
    label: "View calendar",
    href: "/calendar",
    icon: Calendar,
    color: "var(--accent-amber)",
    colorMuted: "var(--accent-amber-muted)",
  },
] as const;

export function QuickActions() {
  return (
    <div style={{ animation: "fadeSlideUp 0.5s ease 0.6s both" }}>
      <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.06em] text-tertiary">
        Quick actions
      </p>
      <div className="flex flex-col gap-0.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-all duration-150 hover:bg-surface-hover hover:text-foreground"
            >
              {/* Icon badge */}
              <span
                className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[7px]"
                style={{ color: action.color, background: action.colorMuted }}
              >
                <Icon size={14} />
              </span>
              <span className="flex-1">{action.label}</span>
              <ChevronRight size={14} className="shrink-0 opacity-30" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
