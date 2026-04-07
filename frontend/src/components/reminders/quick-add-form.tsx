"use client";

import { useState } from "react";
import { Clock, Flag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useCreateReminder } from "@/hooks/use-reminders";

const RECURRENCE_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

function withTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function QuickAddForm() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const createReminder = useCreateReminder();

  const canSubmit = title.trim().length > 0 && date.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const isFloating = time === "";
    const remindAt = isFloating
      ? withTzOffset(date, "00:00")
      : withTzOffset(date, time);

    createReminder.mutate(
      {
        title: title.trim(),
        remind_at: remindAt,
        is_floating: isFloating,
        is_urgent: isUrgent,
        recurrence_rule: recurrenceRule || undefined,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDate("");
          setTime("");
          setIsUrgent(false);
          setRecurrenceRule("");
          toast.success("Reminder created");
        },
        onError: () => toast.error("Failed to create reminder"),
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
    >
      {/* Title */}
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label
          htmlFor="reminder-title"
          className="text-xs font-medium text-muted-foreground"
        >
          Title
        </label>
        <Input
          id="reminder-title"
          placeholder="e.g. Call dentist"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Date */}
      <div className="flex min-w-[180px] flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Date
        </label>
        <DatePicker value={date} onChange={setDate} placeholder="Pick date" />
      </div>

      {/* Time (optional) */}
      <div className="flex min-w-[130px] flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Time (optional)
        </label>
        {time ? (
          <div className="flex items-center gap-1">
            <TimePicker value={time} onChange={setTime} />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setTime("")}
              title="Clear time"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="justify-start text-left font-normal text-muted-foreground"
            onClick={() => setTime("09:00")}
          >
            <Clock className="h-4 w-4 opacity-60 shrink-0" />
            <span className="text-sm">Add time</span>
          </Button>
        )}
      </div>

      {/* Recurrence */}
      <div className="flex min-w-[130px] flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Repeat
        </label>
        <Select
          value={recurrenceRule}
          onChange={(e) => setRecurrenceRule(e.target.value)}
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Urgent toggle */}
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setIsUrgent(!isUrgent)}
        className={
          isUrgent
            ? "border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600"
            : ""
        }
        title={isUrgent ? "Remove urgent" : "Mark as urgent"}
      >
        <Flag className="h-4 w-4" fill={isUrgent ? "currentColor" : "none"} />
      </Button>

      {/* Submit */}
      <Button
        type="submit"
        size="default"
        disabled={!canSubmit || createReminder.isPending}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {createReminder.isPending ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}
