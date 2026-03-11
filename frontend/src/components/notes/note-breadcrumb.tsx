"use client";

import { ChevronRight } from "lucide-react";

interface NoteBreadcrumbProps {
  path: string;
}

export function NoteBreadcrumb({ path }: NoteBreadcrumbProps) {
  const segments = path.split("/").filter(Boolean);

  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-sm text-[var(--text-secondary)]"
      data-testid="note-breadcrumb"
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="size-3.5 shrink-0 opacity-40" />
            )}
            <span
              className={
                isLast
                  ? "font-semibold text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
              }
            >
              {segment}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
