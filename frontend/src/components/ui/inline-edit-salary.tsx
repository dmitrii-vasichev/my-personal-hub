"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Check, DollarSign, Pencil, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

const PERIOD_LABEL: Record<string, string> = {
  yearly: "/yr",
  hourly: "/hr",
};

function formatSalary(min?: number, max?: number, currency = "USD", period = "yearly"): string | null {
  if (!min && !max) return null;
  const suffix = PERIOD_LABEL[period] ?? "/yr";
  if (period === "hourly") {
    const fmt = (n: number) => `${currency} ${n}`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}${suffix}`;
    if (min) return `from ${fmt(min)}${suffix}`;
    return `up to ${fmt(max!)}${suffix}`;
  }
  const fmt = (n: number) =>
    `${currency} ${n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}${suffix}`;
  if (min) return `from ${fmt(min)}${suffix}`;
  return `up to ${fmt(max!)}${suffix}`;
}

interface InlineEditSalaryProps {
  min?: number;
  max?: number;
  currency: string;
  period: string;
  onSave: (data: { salary_min: number | null; salary_max: number | null; salary_currency: string; salary_period: string }) => Promise<void>;
}

export function InlineEditSalary({ min, max, currency, period, onSave }: InlineEditSalaryProps) {
  const [editing, setEditing] = useState(false);
  const [draftMin, setDraftMin] = useState(min?.toString() ?? "");
  const [draftMax, setDraftMax] = useState(max?.toString() ?? "");
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [draftPeriod, setDraftPeriod] = useState(period);
  const [saving, setSaving] = useState(false);
  const minRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
    setDraftPeriod(period);
  }, [min, max, currency, period]);

  useEffect(() => { if (editing) minRef.current?.focus(); }, [editing]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        salary_min: draftMin ? parseInt(draftMin, 10) : null,
        salary_max: draftMax ? parseInt(draftMax, 10) : null,
        salary_currency: draftCurrency || "USD",
        salary_period: draftPeriod,
      });
      setEditing(false);
    } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draftMin, draftMax, draftCurrency, draftPeriod, onSave]);

  const cancel = useCallback(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
    setDraftPeriod(period);
    setEditing(false);
  }, [min, max, currency, period]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  const formatted = formatSalary(min, max, currency, period);

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <input
            ref={minRef}
            type="number"
            value={draftMin}
            onChange={(e) => setDraftMin(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Min"
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
          <input
            type="number"
            value={draftMax}
            onChange={(e) => setDraftMax(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Max"
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
          <input
            type="text"
            value={draftCurrency}
            onChange={(e) => setDraftCurrency(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="USD"
            maxLength={5}
            disabled={saving}
            className="w-full rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30"
          />
        </div>
        {/* Period toggle */}
        <div className="flex items-center gap-1">
          {(["yearly", "hourly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDraftPeriod(p)}
              disabled={saving}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                draftPeriod === p
                  ? "bg-[var(--accent)] text-[var(--primary-foreground)]"
                  : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Tooltip content="Save">
            <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Cancel">
            <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 text-sm text-[var(--text-primary)] cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <DollarSign className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      <span className={formatted ? "" : "text-[var(--text-tertiary)] italic"}>{formatted ?? "Not set"}</span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </div>
  );
}
