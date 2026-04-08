"use client";

import { useState } from "react";
import { Calendar, Clock, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Tooltip } from "@/components/ui/tooltip";

const pad2 = (n: number) => String(n).padStart(2, "0");

function withTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

function parseValue(value: string | null, isFloating: boolean) {
  if (!value) return { datePart: "", timePart: "" };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { datePart: "", timePart: "" };
  return {
    datePart: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timePart: isFloating ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function formatDisplay(value: string, isFloating: boolean) {
  const d = new Date(value);
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  if (isFloating) return `${dateStr} · All day`;
  const timeStr = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${dateStr} ${timeStr}`;
}

interface TaskReminderEditProps {
  value: string | null;
  isFloating: boolean;
  onSave: (data: { reminder_at: string | null; reminder_floating?: boolean }) => Promise<void>;
}

export function TaskReminderEdit({ value, isFloating, onSave }: TaskReminderEditProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = parseValue(value, isFloating);
  const [date, setDate] = useState(parsed.datePart);
  const [time, setTime] = useState(parsed.timePart);

  const handleEdit = () => {
    const p = parseValue(value, isFloating);
    setDate(p.datePart);
    setTime(p.timePart);
    setEditing(true);
  };

  const handleDateChange = async (newDate: string) => {
    if (!newDate) {
      // Clearing date = clearing entire reminder
      setSaving(true);
      try {
        await onSave({ reminder_at: null });
        setDate("");
        setTime("");
        setEditing(false);
      } finally {
        setSaving(false);
      }
      return;
    }
    setDate(newDate);
    const floating = time === "";
    const remindAt = floating
      ? withTzOffset(newDate, "00:00")
      : withTzOffset(newDate, time);
    setSaving(true);
    try {
      await onSave({ reminder_at: remindAt, reminder_floating: floating });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    setTime(newTime);
    const d = date;
    if (!d) return;
    const remindAt = withTzOffset(d, newTime);
    setSaving(true);
    try {
      await onSave({ reminder_at: remindAt, reminder_floating: false });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClearTime = async () => {
    setTime("");
    if (!date) return;
    const remindAt = withTzOffset(date, "00:00");
    setSaving(true);
    try {
      await onSave({ reminder_at: remindAt, reminder_floating: true });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await onSave({ reminder_at: null });
      setDate("");
      setTime("");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DatePicker
            value={date}
            onChange={handleDateChange}
            placeholder="No reminder"
            clearable
          />
        </div>
        {date && (
          time ? (
            <div className="flex items-center gap-1">
              <TimePicker value={time} onChange={handleTimeChange} />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleClearTime}
                disabled={saving}
                title="Clear time (all-day)"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="justify-start text-left font-normal text-muted-foreground"
              onClick={() => handleTimeChange("09:00")}
              disabled={saving}
            >
              <Clock className="h-4 w-4 opacity-60 shrink-0" />
              <span className="text-sm">Add time</span>
            </Button>
          )
        )}
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 cursor-pointer"
      onClick={handleEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); }}
    >
      <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      <span className={value ? "text-sm text-[var(--text-primary)]" : "text-sm text-[var(--text-tertiary)] italic"}>
        {value ? formatDisplay(value, isFloating) : "No reminder"}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
      {value && (
        <Tooltip content="Clear">
          <button
            onClick={handleClear}
            disabled={saving}
            className="rounded p-0.5 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 hover:text-[var(--danger)] transition-all"
          >
            <X className="h-3 w-3" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
