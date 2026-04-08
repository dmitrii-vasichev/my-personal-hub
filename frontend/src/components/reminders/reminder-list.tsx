"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  format,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  Check,
  Clock,
  Trash2,
  Bell,
  Flag,
  ListTodo,
  Pencil,
  Repeat,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  useMarkDone,
  useSnoozeReminder,
  useUpdateReminder,
  useDeleteReminder,
} from "@/hooks/use-reminders";
import type { Reminder } from "@/types/reminder";

// -- Recurrence badge label --

const WEEKDAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

function recurrenceLabel(rule: string): string {
  if (rule.startsWith("custom:")) {
    const days = rule.slice(7).split(",");
    return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ");
  }
  const labels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  return labels[rule] ?? rule;
}

// -- Snooze badge colors based on snooze_count --

function snoozeBadgeClass(count: number): string {
  if (count >= 5) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (count >= 3) return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

// -- Date grouping --

interface DateGroup {
  label: string;
  sortKey: number;
  reminders: Reminder[];
}

function groupByDate(reminders: Reminder[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();

  for (const r of reminders) {
    const dt = parseISO(r.remind_at);
    const day = startOfDay(dt);
    const key = day.toISOString();

    let label: string;
    if (isToday(day)) {
      label = "Today";
    } else if (isTomorrow(day)) {
      label = "Tomorrow";
    } else {
      label = format(day, "MMMM d, yyyy");
    }

    if (!groups.has(key)) {
      groups.set(key, { label, sortKey: day.getTime(), reminders: [] });
    }
    groups.get(key)!.reminders.push(r);
  }

  // Sort groups chronologically, reminders within group by tier
  const sorted = Array.from(groups.values()).sort(
    (a, b) => a.sortKey - b.sortKey
  );
  for (const g of sorted) {
    g.reminders.sort((a, b) => {
      // 1. Urgent floating first
      const aUrgentFloat = a.is_urgent && a.is_floating ? 0 : 1;
      const bUrgentFloat = b.is_urgent && b.is_floating ? 0 : 1;
      if (aUrgentFloat !== bUrgentFloat) return aUrgentFloat - bUrgentFloat;

      // 2. Time-bound before normal floating
      const aFloat = a.is_floating ? 1 : 0;
      const bFloat = b.is_floating ? 1 : 0;
      if (aFloat !== bFloat) return aFloat - bFloat;

      // 3. Within same tier: time-bound by time, floating by creation
      if (!a.is_floating && !b.is_floating) {
        return new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime();
      }
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }
  return sorted;
}

// -- Tomorrow-at helper --

function tomorrowAt(hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const offset = d.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// -- Timezone offset helper --

const pad2 = (n: number) => String(n).padStart(2, "0");

function withTzOffset(dateStr: string, timeStr: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${dateStr}T${timeStr}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

const RECURRENCE_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom…" },
] as const;

// -- Edit dialog (form mounts fresh when dialog opens → no useEffect needed) --

function EditReminderForm({
  reminder,
  onClose,
}: {
  reminder: Reminder;
  onClose: () => void;
}) {
  // Parse initial date/time from reminder
  const initialDate = format(parseISO(reminder.remind_at), "yyyy-MM-dd");
  const initialTime = reminder.is_floating ? "" : format(parseISO(reminder.remind_at), "HH:mm");

  const [title, setTitle] = useState(reminder.title);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [isUrgent, setIsUrgent] = useState(reminder.is_urgent);

  const existingRule = reminder.recurrence_rule ?? "";
  const isExistingCustom = existingRule.startsWith("custom:");
  const [recurrenceRule, setRecurrenceRule] = useState(
    isExistingCustom ? "custom" : existingRule
  );
  const [customDays, setCustomDays] = useState<string[]>(
    isExistingCustom ? existingRule.slice(7).split(",") : []
  );
  const updateReminder = useUpdateReminder();

  const isCustom = recurrenceRule === "custom";
  const toggleDay = (day: string) =>
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  const canSubmit =
    title.trim().length > 0 &&
    date.length > 0 &&
    (!isCustom || customDays.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const isFloating = time === "";
    const remindAt = isFloating
      ? withTzOffset(date, "00:00")
      : withTzOffset(date, time);

    updateReminder.mutate(
      {
        id: reminder.id,
        title: title.trim(),
        remind_at: remindAt,
        is_floating: isFloating,
        is_urgent: isUrgent,
        recurrence_rule: isCustom
          ? `custom:${customDays.join(",")}`
          : recurrenceRule || null,
      },
      {
        onSuccess: () => {
          toast.success("Reminder updated");
          onClose();
        },
        onError: () => toast.error("Failed to update reminder"),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
        </div>
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
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Date
        </label>
        <DatePicker value={date} onChange={setDate} placeholder="Pick date" />
      </div>
      <div className="space-y-1.5">
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
            className="justify-start text-left font-normal text-muted-foreground w-full"
            onClick={() => setTime("09:00")}
          >
            <Clock className="h-4 w-4 opacity-60 shrink-0" />
            <span className="text-sm">Add time</span>
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Repeat
        </label>
        <Select
          value={isCustom ? "custom" : recurrenceRule}
          onChange={(e) => {
            setRecurrenceRule(e.target.value);
            if (e.target.value !== "custom") setCustomDays([]);
          }}
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        {isCustom && (
          <div className="flex gap-1 pt-1">
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
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || updateReminder.isPending}
        >
          {updateReminder.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EditReminderDialog({
  reminder,
  open,
  onOpenChange,
}: {
  reminder: Reminder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogClose />
          <DialogTitle>Edit reminder</DialogTitle>
          {open && (
            <EditReminderForm
              reminder={reminder}
              onClose={() => onOpenChange(false)}
            />
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// -- Single reminder row --

function ReminderRow({ reminder, expanded, onToggle }: { reminder: Reminder; expanded: boolean; onToggle: () => void }) {
  const markDone = useMarkDone();
  const snooze = useSnoozeReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState<'desktop' | 'mobile' | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const timeDisplay = reminder.is_floating
    ? (reminder.is_urgent ? "\u{1F534}" : "\u{1F4CC}")
    : format(parseISO(reminder.remind_at), "HH:mm");
  const isPending =
    markDone.isPending || snooze.isPending || updateReminder.isPending || deleteReminder.isPending;

  const handleReschedule = (remindAt: string) => {
    updateReminder.mutate(
      { id: reminder.id, remind_at: remindAt },
      {
        onSuccess: () => {
          toast.success("Rescheduled");
          setSnoozeOpen(null);
        },
        onError: () => toast.error("Failed to reschedule"),
      }
    );
  };

  const handleDone = () => {
    markDone.mutate(reminder.id, {
      onError: () => toast.error("Failed to mark as done"),
    });
  };

  const handleSnooze = (minutes: number) => {
    snooze.mutate(
      { id: reminder.id, minutes },
      {
        onSuccess: () => {
          toast.success(`Snoozed for ${minutes >= 60 ? `${minutes / 60}h` : `${minutes}min`}`);
          setSnoozeOpen(null);
        },
        onError: () => toast.error("Failed to snooze"),
      }
    );
  };

  const handleDelete = () => {
    deleteReminder.mutate(reminder.id, {
      onSuccess: () => {
        toast.success("Reminder deleted");
        setConfirmDelete(false);
      },
      onError: () => toast.error("Failed to delete"),
    });
  };

  /* -- Desktop inline action icons (hidden on mobile) -- */
  const desktopActions = (
    <div className="hidden shrink-0 items-center gap-1 md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
      <Tooltip content="Mark done">
        <Button variant="ghost" size="icon-xs" onClick={handleDone} disabled={isPending}>
          <Check className="h-3.5 w-3.5 text-green-600" />
        </Button>
      </Tooltip>
      <Tooltip content="Edit">
        <Button variant="ghost" size="icon-xs" onClick={() => setEditOpen(true)} disabled={isPending}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {!reminder.is_floating && (
        <Popover open={snoozeOpen === 'desktop'} onOpenChange={(open) => setSnoozeOpen(open ? 'desktop' : null)}>
          <Tooltip content="Snooze">
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-xs" disabled={isPending}>
                  <Bell className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </Tooltip>
          <PopoverContent align="end" className="w-48 p-1">
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleSnooze(15)}>15 minutes</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleSnooze(60)}>1 hour</button>
            <div className="my-1 h-px bg-border" />
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(10))}>Tomorrow, 10:00</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(14))}>Tomorrow, 14:00</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(18))}>Tomorrow, 18:00</button>
            <div className="my-1 h-px bg-border" />
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => { setSnoozeOpen(null); setEditOpen(true); }}>Other...</button>
          </PopoverContent>
        </Popover>
      )}
      <Tooltip content="Delete">
        <Button variant="ghost" size="icon-xs" onClick={() => setConfirmDelete(true)} disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </Tooltip>
    </div>
  );

  /* -- Mobile expanded action panel -- */
  const mobileActions = expanded && (
    <div className={`grid ${reminder.is_floating ? "grid-cols-3" : "grid-cols-4"} gap-2 border-t border-border bg-muted/30 px-4 py-2.5 md:hidden`}>
      <button
        className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium active:bg-muted"
        onClick={handleDone}
        disabled={isPending}
      >
        <Check className="h-5 w-5 text-green-600" />
        Done
      </button>
      <button
        className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium active:bg-muted"
        onClick={() => setEditOpen(true)}
        disabled={isPending}
      >
        <Pencil className="h-5 w-5" />
        Edit
      </button>
      {!reminder.is_floating && (
        <Popover open={snoozeOpen === 'mobile'} onOpenChange={(open) => setSnoozeOpen(open ? 'mobile' : null)}>
          <PopoverTrigger
            render={
              <button
                className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium active:bg-muted"
                disabled={isPending}
              >
                <Bell className="h-5 w-5" />
                Snooze
              </button>
            }
          />
          <PopoverContent align="center" className="w-48 p-1">
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleSnooze(15)}>15 minutes</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleSnooze(60)}>1 hour</button>
            <div className="my-1 h-px bg-border" />
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(10))}>Tomorrow, 10:00</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(14))}>Tomorrow, 14:00</button>
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => handleReschedule(tomorrowAt(18))}>Tomorrow, 18:00</button>
            <div className="my-1 h-px bg-border" />
            <button className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted" onClick={() => { setSnoozeOpen(null); setEditOpen(true); }}>Other...</button>
          </PopoverContent>
        </Popover>
      )}
      <button
        className="flex flex-col items-center gap-1 rounded-lg py-2 text-xs font-medium text-destructive active:bg-muted"
        onClick={() => setConfirmDelete(true)}
        disabled={isPending}
      >
        <Trash2 className="h-5 w-5" />
        Delete
      </button>
    </div>
  );

  return (
    <>
      <div className={`group overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-muted/50 ${expanded ? "ring-1 ring-primary/20" : ""}`}>
        {/* Main row — tappable on mobile */}
        <div
          className="flex cursor-pointer items-center gap-3 px-4 py-3 md:cursor-default"
          onClick={onToggle}
        >
          {/* Time */}
          <span className="w-12 shrink-0 text-sm font-mono text-muted-foreground">
            {timeDisplay}
          </span>

          {/* Title + badges */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {reminder.title}
            </span>

            {reminder.is_urgent && (
              <span className="inline-flex items-center rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Urgent
              </span>
            )}

            {reminder.snooze_count > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${snoozeBadgeClass(reminder.snooze_count)}`}
              >
                <Clock className="h-3 w-3" />
                {reminder.snooze_count}
              </span>
            )}

            {reminder.task_id && (
              <Link href={`/tasks?task=${reminder.task_id}`} onClick={(e) => e.stopPropagation()}>
                <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50">
                  <ListTodo className="h-3 w-3" />
                  Task
                </span>
              </Link>
            )}

            {reminder.recurrence_rule && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <Repeat className="h-3 w-3" />
                {recurrenceLabel(reminder.recurrence_rule)}
              </span>
            )}
          </div>

          {/* Desktop: inline hover actions */}
          {desktopActions}
        </div>

        {/* Mobile: expanded action panel */}
        {mobileActions}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Delete reminder"
        description={`Are you sure you want to delete "${reminder.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteReminder.isPending}
      />

      <EditReminderDialog
        reminder={reminder}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

// -- Main list component --

interface ReminderListProps {
  reminders: Reminder[];
  isLoading: boolean;
  error: Error | null;
}

export function ReminderList({ reminders, isLoading, error }: ReminderListProps) {
  const groups = useMemo(() => groupByDate(reminders), [reminders]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        Failed to load reminders
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            No reminders
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the form above to create your first reminder
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.reminders.map((r) => (
              <ReminderRow
                key={r.id}
                reminder={r}
                expanded={expandedId === r.id}
                onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
