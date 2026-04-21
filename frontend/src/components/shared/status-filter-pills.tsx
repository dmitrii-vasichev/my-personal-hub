"use client";

export interface StatusFilterPillStatus {
  value: string;
  label: string;
  count: number;
}

interface Props {
  statuses: StatusFilterPillStatus[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  className?: string;
  ariaLabel?: string;
}

export function StatusFilterPills({
  statuses,
  selected,
  onSelect,
  className,
  ariaLabel = "Filter by status",
}: Props) {
  const pillClass = (active: boolean) =>
    `shrink-0 border px-3 min-h-[44px] inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.1em] font-mono transition-colors ${
      active
        ? "bg-[color:var(--accent)] text-[color:var(--bg)] border-[color:var(--accent)]"
        : "bg-transparent text-[color:var(--ink)] border-[color:var(--line)] hover:border-[color:var(--ink)]"
    }`;

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-2 ${className ?? ""}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className={pillClass(selected === null)}
        data-selected={selected === null}
        onClick={() => onSelect(null)}
      >
        ALL
      </button>
      {statuses.map((s) => (
        <button
          key={s.value}
          type="button"
          className={pillClass(selected === s.value)}
          data-selected={selected === s.value}
          onClick={() => onSelect(s.value)}
        >
          {s.label} <span className="opacity-60">{s.count}</span>
        </button>
      ))}
    </div>
  );
}
