"use client";

import { cn } from "@/lib/utils";

export type Period = "7d" | "30d" | "90d";

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

const periods: { label: string; value: Period }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
];

export function periodToDays(period: Period): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
  }
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex gap-1 rounded-lg border border-border-subtle bg-surface p-0.5">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer",
            value === p.value
              ? "bg-primary text-white"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
