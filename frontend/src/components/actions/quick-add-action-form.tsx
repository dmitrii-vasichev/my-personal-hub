"use client";

import { useState } from "react";
import { Clock, Flag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useCreateAction } from "@/hooks/use-actions";

const RECURRENCE_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom…" },
] as const;

const RECURRENCE_LABELS: Record<string, string> = Object.fromEntries(
  RECURRENCE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const WEEKDAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

const pad2 = (n: number) => String(n).padStart(2, "0");

function withTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function QuickAddActionForm() {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customDays, setCustomDays] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const createAction = useCreateAction();

  const isCustom = recurrenceRule === "custom";
  const canSubmit =
    title.trim().length > 0 && (!isCustom || customDays.length > 0);

  const toggleDay = (day: string) =>
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );

  const collapse = () => {
    setExpanded(false);
    setTitle("");
    setDate("");
    setTime("");
    setIsUrgent(false);
    setRecurrenceRule("");
    setCustomDays([]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const remindAt = date && time ? withTzOffset(date, time) : undefined;

    createAction.mutate(
      {
        title: title.trim(),
        action_date: date || undefined,
        remind_at: remindAt,
        is_urgent: isUrgent,
        recurrence_rule: isCustom
          ? `custom:${customDays.join(",")}`
          : recurrenceRule || undefined,
      },
      {
        onSuccess: () => {
          collapse();
          toast.success("Action created");
        },
        onError: () => toast.error("Failed to create action"),
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-[1.5px] border-dashed border-[color:var(--line-2)] bg-transparent p-1.5 font-mono sm:p-3"
    >
      {/* Title row — always visible */}
      <div className="flex items-center gap-2">
        <Input
          id="action-title"
          placeholder="Action…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setExpanded(true)}
          autoComplete="off"
          className="min-h-9 flex-1 border-0 bg-transparent px-0 font-mono text-[16px] italic shadow-none rounded-none placeholder:italic placeholder:text-[color:var(--ink-3)] focus-visible:border-0 focus-visible:ring-0 sm:min-h-10 md:text-[13px]"
        />
        {expanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="max-md:size-9"
            onClick={collapse}
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Expandable fields */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-2 pt-2 sm:gap-3 sm:pt-3 md:flex-row md:flex-wrap md:items-end">
            {/* Date + Time — stacked on mobile, side by side from sm */}
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 md:contents">
              <div className="flex flex-col gap-1 md:min-w-[180px]">
                <label className="text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
                  Date
                </label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  placeholder="Pick date"
                />
              </div>

              <div className="flex flex-col gap-1 md:min-w-[130px]">
                <label className="text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
                  Time (optional)
                </label>
                {time ? (
                  <div className="flex items-center gap-1">
                    <TimePicker
                      value={time}
                      onChange={setTime}
                      className="min-w-0 flex-1 shrink sm:flex-none sm:shrink-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="max-md:size-11"
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
                    className="w-full justify-start text-left font-normal text-muted-foreground"
                    disabled={!date}
                    onClick={() => setTime("09:00")}
                  >
                    <Clock className="h-4 w-4 opacity-60 shrink-0" />
                    <span className="text-sm">Add time</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Repeat + Urgent + Add */}
            <div className="flex items-end gap-2 sm:gap-3 md:contents">
              <div className="flex flex-1 flex-col gap-1 md:min-w-[130px] md:flex-initial">
                <label className="text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
                  Repeat
                </label>
                <SelectRoot
                  value={isCustom ? "custom" : recurrenceRule}
                  onValueChange={(value) => {
                    setRecurrenceRule(value);
                    if (value !== "custom") setCustomDays([]);
                  }}
                  labels={RECURRENCE_LABELS}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </SelectRoot>
              </div>

              {isCustom && (
                <div className="flex items-end gap-1">
                  {WEEKDAYS.map((wd) => (
                    <button
                      key={wd.key}
                      type="button"
                      onClick={() => toggleDay(wd.key)}
                      className={`h-8 w-9 rounded-md border text-xs font-medium transition-colors ${
                        customDays.includes(wd.key)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-transparent text-muted-foreground hover:bg-muted dark:bg-input/30"
                      }`}
                    >
                      {wd.label}
                    </button>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`shrink-0 ${
                  isUrgent
                    ? "border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600"
                    : ""
                }`}
                title={isUrgent ? "Remove urgent" : "Mark as urgent"}
              >
                <Flag
                  className="h-4 w-4"
                  fill={isUrgent ? "currentColor" : "none"}
                />
              </Button>

              <Button
                type="submit"
                size="default"
                disabled={!canSubmit || createAction.isPending}
                className="shrink-0 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {createAction.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
