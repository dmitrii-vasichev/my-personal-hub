"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/types/pulse-source";

const ALL_TAB = { id: null, label: "All" };

const TABS = [
  ALL_TAB,
  ...Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label })),
];

interface CategoryTabsProps {
  active: string | null;
  onChange: (category: string | null) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-1" data-testid="category-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id ?? "all"}
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            active === tab.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
