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
  ListTodo,
  Pencil,
  Repeat,
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  useMarkDone,
  useSnoozeReminder,
  useUpdateReminder,
  useDeleteReminder,
} from "@/hooks/use-reminders";
import type { Reminder } from "@/types/reminder";

// -- Recurrence badge label --

function recurrenceLabel(rule: string): string {
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

  // Sort groups chronologically, reminders within group by time
  const sorted = Array.from(groups.values()).sort(
    (a, b) => a.sortKey - b.sortKey
  );
  for (const g of sorted) {
    g.reminders.sort(
      (a, b) =>
        new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
    );
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

const RECURRENCE_OPTIONS = [
  { value: "", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

// -- Edit dialog (form mounts fresh when dialog opens → no useEffect needed) --

function EditReminderForm({
  reminder,
  onClose,
}: {
  reminder: Reminder;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(reminder.title);
  const [remindAt, setRemindAt] = useState(reminder.remind_at);
  const [recurrenceRule, setRecurrenceRule] = useState(
    reminder.recurrence_rule ?? ""
  );
  const updateReminder = useUpdateReminder();

  const canSubmit = title.trim().length > 0 && remindAt.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    updateReminder.mutate(
      {
        id: reminder.id,
        title: title.trim(),
        remind_at: remindAt,
        recurrence_rule: recurrenceRule || null,
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
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Date & Time
        </label>
        <DateTimePicker value={remindAt} onChange={setRemindAt} />
      </div>
      <div className="space-y-1.5">
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

function ReminderRow({ reminder }: { reminder: Reminder }) {
  const markDone = useMarkDone();
  const snooze = useSnoozeReminder();
  const updateReminder = useUpdateReminder();
  const deleteReminder = useDeleteReminder();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const time = format(parseISO(reminder.remind_at), "HH:mm");
  const isPending =
    markDone.isPending || snooze.isPending || updateReminder.isPending || deleteReminder.isPending;

  const handleReschedule = (remindAt: string) => {
    updateReminder.mutate(
      { id: reminder.id, remind_at: remindAt },
      {
        onSuccess: () => {
          toast.success("Rescheduled");
          setSnoozeOpen(false);
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
          setSnoozeOpen(false);
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

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50">
        {/* Time */}
        <span className="w-12 shrink-0 text-sm font-mono text-muted-foreground">
          {time}
        </span>

        {/* Title + badges */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {reminder.title}
          </span>

          {/* Snooze badge */}
          {reminder.snooze_count > 0 && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${snoozeBadgeClass(reminder.snooze_count)}`}
            >
              <Clock className="h-3 w-3" />
              {reminder.snooze_count}
            </span>
          )}

          {/* Task badge */}
          {reminder.task_id && (
            <Link href={`/tasks?task=${reminder.task_id}`}>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-100 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50">
                <ListTodo className="h-3 w-3" />
                Task
              </span>
            </Link>
          )}

          {/* Recurrence badge */}
          {reminder.recurrence_rule && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
              <Repeat className="h-3 w-3" />
              {recurrenceLabel(reminder.recurrence_rule)}
            </span>
          )}
        </div>

        {/* Actions — always visible on mobile, hover-only on desktop */}
        <div className="flex shrink-0 items-center gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
          {/* Done */}
          <Tooltip content="Mark done">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDone}
              disabled={isPending}
            >
              <Check className="h-3.5 w-3.5 text-green-600" />
            </Button>
          </Tooltip>

          {/* Edit */}
          <Tooltip content="Edit">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setEditOpen(true)}
              disabled={isPending}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>

          {/* Snooze dropdown */}
          <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
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
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => handleSnooze(15)}
              >
                15 minutes
              </button>
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => handleSnooze(60)}
              >
                1 hour
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => handleReschedule(tomorrowAt(10))}
              >
                Tomorrow, 10:00
              </button>
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => handleReschedule(tomorrowAt(14))}
              >
                Tomorrow, 14:00
              </button>
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => handleReschedule(tomorrowAt(18))}
              >
                Tomorrow, 18:00
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                className="flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                onClick={() => {
                  setSnoozeOpen(false);
                  setEditOpen(true);
                }}
              >
                Other...
              </button>
            </PopoverContent>
          </Popover>

          {/* Delete */}
          <Tooltip content="Delete">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
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
              <ReminderRow key={r.id} reminder={r} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
