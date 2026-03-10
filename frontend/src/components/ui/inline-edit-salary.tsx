"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Check, DollarSign, Pencil, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

function formatSalary(min?: number, max?: number, currency = "USD"): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    `${currency} ${n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `from ${fmt(min)}`;
  return `up to ${fmt(max!)}`;
}

interface InlineEditSalaryProps {
  min?: number;
  max?: number;
  currency: string;
  onSave: (data: { salary_min: number | null; salary_max: number | null; salary_currency: string }) => Promise<void>;
}

export function InlineEditSalary({ min, max, currency, onSave }: InlineEditSalaryProps) {
  const [editing, setEditing] = useState(false);
  const [draftMin, setDraftMin] = useState(min?.toString() ?? "");
  const [draftMax, setDraftMax] = useState(max?.toString() ?? "");
  const [draftCurrency, setDraftCurrency] = useState(currency);
  const [saving, setSaving] = useState(false);
  const minRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
  }, [min, max, currency]);

  useEffect(() => { if (editing) minRef.current?.focus(); }, [editing]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        salary_min: draftMin ? parseInt(draftMin, 10) : null,
        salary_max: draftMax ? parseInt(draftMax, 10) : null,
        salary_currency: draftCurrency || "USD",
      });
      setEditing(false);
    } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draftMin, draftMax, draftCurrency, onSave]);

  const cancel = useCallback(() => {
    setDraftMin(min?.toString() ?? "");
    setDraftMax(max?.toString() ?? "");
    setDraftCurrency(currency);
    setEditing(false);
  }, [min, max, currency]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  const formatted = formatSalary(min, max, currency);

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
