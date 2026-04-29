"use client";

import { useMemo, useState } from "react";
import {
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import {
  Check,
  Clock,
  Trash2,
  Bell,
  Flag,
  ListChecks,
  Pencil,
  Pin,
  Repeat,
  StickyNote,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { StartFocusButton } from "@/components/focus/start-focus-button";
import { ChecklistEditor } from "@/components/tasks/checklist-editor";
import {
  useDeleteAction,
  useMarkActionDone,
  useSnoozeAction,
  useUpdateAction,
} from "@/hooks/use-actions";
import type { Action } from "@/types/action";
import type { ChecklistItem } from "@/types/task";

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

// -- Snooze badge colors based on snooze_count (brutalist border-only chips) --

function snoozeBadgeClass(count: number): string {
  if (count >= 5)
    return "border-[color:var(--accent-2)] text-[color:var(--accent-2)]";
  if (count >= 3)
    return "border-[color:var(--accent-2)] text-[color:var(--accent-2)]";
  return "border-[color:var(--line)] text-[color:var(--ink-3)]";
}

// -- Relative label for "IN X" countdown (mockup .when subtext) --

function relativeLabel(iso: string | null): string {
  if (!iso) return "";
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "NOW";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `IN ${mins}M`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `IN ${hours}H`;
  const days = Math.round(hours / 24);
  return `IN ${days}D`;
}

// -- Date grouping --

interface DateGroup {
  label: string;
  sortKey: number;
  actions: Action[];
}

function actionDay(action: Action): Date | null {
  const source = action.action_date ?? action.remind_at;
  if (!source) return null;
  return startOfDay(parseISO(source));
}

function groupByDate(actions: Action[], todayInput: Date = new Date()): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  const today = startOfDay(todayInput);

  for (const action of actions) {
    const day = actionDay(action);
    const key = day ? (day < today ? "overdue" : day.toISOString()) : "inbox";

    let label: string;
    let sortKey: number;
    if (!day) {
      label = "Inbox/Someday";
      sortKey = Number.MAX_SAFE_INTEGER;
    } else if (day < today) {
      label = "Overdue";
      sortKey = Number.MIN_SAFE_INTEGER;
    } else if (day.getTime() === today.getTime()) {
      label = "Today";
      sortKey = day.getTime();
    } else {
      label = format(day, "MMMM d, yyyy");
      sortKey = day.getTime();
    }

    if (!groups.has(key)) {
      groups.set(key, { label, sortKey, actions: [] });
    }
    groups.get(key)!.actions.push(action);
  }

  const sorted = Array.from(groups.values()).sort(
    (a, b) => a.sortKey - b.sortKey
  );
  for (const g of sorted) {
    g.actions.sort((a, b) => {
      const aScheduled = a.remind_at ? 0 : 1;
      const bScheduled = b.remind_at ? 0 : 1;
      if (aScheduled !== bScheduled) return aScheduled - bScheduled;

      if (a.remind_at && b.remind_at) {
        return new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime();
      }

      const aUrgent = a.is_urgent ? 0 : 1;
      const bUrgent = b.is_urgent ? 0 : 1;
      if (aUrgent !== bUrgent) return aUrgent - bUrgent;
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

const RECURRENCE_LABELS: Record<string, string> = Object.fromEntries(
  RECURRENCE_OPTIONS.map((opt) => [opt.value, opt.label])
);

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function hasUrl(text: string | null | undefined): boolean {
  return /(https?:\/\/[^\s]+)/.test(text ?? "");
}

function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_PATTERN).map((part, index) =>
        part.startsWith("http://") || part.startsWith("https://") ? (
          <a
            key={`${part}-${index}`}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="break-all text-[color:var(--accent)] underline underline-offset-2 hover:text-[color:var(--accent-2)]"
          >
            {part}
          </a>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

// -- Edit dialog (form mounts fresh when dialog opens → no useEffect needed) --

function EditActionForm({
  action,
  onClose,
}: {
  action: Action;
  onClose: () => void;
}) {
  const initialDate = action.action_date
    ? format(parseISO(action.action_date), "yyyy-MM-dd")
    : action.remind_at
      ? format(parseISO(action.remind_at), "yyyy-MM-dd")
      : "";
  const initialTime = action.remind_at ? format(parseISO(action.remind_at), "HH:mm") : "";

  const [title, setTitle] = useState(action.title);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [isUrgent, setIsUrgent] = useState(action.is_urgent);
  const [details, setDetails] = useState(action.details ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(action.checklist ?? []);

  const existingRule = action.recurrence_rule ?? "";
  const isExistingCustom = existingRule.startsWith("custom:");
  const [recurrenceRule, setRecurrenceRule] = useState(
    isExistingCustom ? "custom" : existingRule
  );
  const [customDays, setCustomDays] = useState<string[]>(
    isExistingCustom ? existingRule.slice(7).split(",") : []
  );
  const updateAction = useUpdateAction();

  const isCustom = recurrenceRule === "custom";
  const toggleDay = (day: string) =>
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  const canSubmit =
    title.trim().length > 0 && (!isCustom || customDays.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const remindAt = date && time ? withTzOffset(date, time) : null;
    const actionDate = date || null;

    updateAction.mutate(
      {
        id: action.id,
        title: title.trim(),
        action_date: actionDate,
        remind_at: remindAt,
        is_urgent: isUrgent,
        details: details.trim() || null,
        checklist,
        recurrence_rule: isCustom
          ? `custom:${customDays.join(",")}`
          : recurrenceRule || null,
      },
      {
        onSuccess: () => {
          toast.success("Action updated");
          onClose();
        },
        onError: () => toast.error("Failed to update action"),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <label className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
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
              ? "border-[color:var(--danger)] bg-transparent text-[color:var(--danger)] hover:bg-[color:var(--bg)] hover:text-[color:var(--danger)]"
              : ""
          }
          title={isUrgent ? "Remove urgent" : "Mark as urgent"}
        >
          <Flag className="h-4 w-4" fill={isUrgent ? "currentColor" : "none"} />
        </Button>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            Date
          </label>
          <DatePicker value={date} onChange={setDate} placeholder="Pick date" />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            Time (optional)
          </label>
          {time ? (
            <div className="flex items-center gap-1">
              <TimePicker value={time} onChange={setTime} />
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
              className="justify-start text-left font-normal text-muted-foreground"
              onClick={() => setTime("09:00")}
            >
              <Clock className="h-4 w-4 opacity-60 shrink-0" />
              <span className="text-sm">Add time</span>
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
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
        {isCustom && (
          <div className="flex gap-1 pt-1">
            {WEEKDAYS.map((wd) => (
              <button
                key={wd.key}
                type="button"
                onClick={() => toggleDay(wd.key)}
                className={`h-8 w-9 border-[1.5px] text-xs font-mono font-medium transition-colors ${
                  customDays.includes(wd.key)
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--bg)]"
                    : "border-[color:var(--line)] bg-transparent text-[color:var(--ink-3)] hover:border-[color:var(--line-2)] hover:text-[color:var(--ink-2)]"
                }`}
              >
                {wd.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="action-details"
          className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]"
        >
          Details
        </label>
        <Textarea
          id="action-details"
          aria-label="Action details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Notes, links, quick instructions..."
          rows={4}
          className="resize-y font-mono"
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-[10px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
          Checklist
        </label>
        <ChecklistEditor items={checklist} onChange={setChecklist} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || updateAction.isPending}
        >
          {updateAction.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EditActionDialog({
  action,
  open,
  onOpenChange,
}: {
  action: Action;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6">
          <DialogClose />
          <DialogTitle>Edit action</DialogTitle>
          {open && (
            <EditActionForm
              action={action}
              onClose={() => onOpenChange(false)}
            />
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// -- Single reminder row --

function ActionRow({ action, expanded, onToggle }: { action: Action; expanded: boolean; onToggle: () => void }) {
  const markDone = useMarkActionDone();
  const snooze = useSnoozeAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const effectiveTime = action.snoozed_until ?? action.remind_at;
  const isScheduled = Boolean(action.remind_at);
  const isPending =
    markDone.isPending || snooze.isPending || updateAction.isPending || deleteAction.isPending;

  const handleReschedule = (remindAt: string) => {
    updateAction.mutate(
      { id: action.id, action_date: remindAt.slice(0, 10), remind_at: remindAt },
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
    markDone.mutate(action.id, {
      onError: () => toast.error("Failed to mark as done"),
    });
  };

  const handleSnooze = (minutes: number) => {
    snooze.mutate(
      { id: action.id, minutes },
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
    deleteAction.mutate(action.id, {
      onSuccess: () => {
        toast.success("Action deleted");
        setConfirmDelete(false);
      },
      onError: () => toast.error("Failed to delete"),
    });
  };

  const isDone = action.status === "done";
  const checklist = action.checklist ?? [];
  const doneCount = checklist.filter((item) => item.completed).length;
  const details = action.details?.trim() ?? "";
  const hasDetails = details.length > 0;
  const hasChecklist = checklist.length > 0;
  const detailsHaveUrl = hasUrl(details);

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't collapse if the click happened on a stop-propagation child.
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea")) {
      return;
    }
    onToggle();
  };

  const handleChecklistToggle = (itemId: string) => {
    const nextChecklist = checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    updateAction.mutate(
      { id: action.id, checklist: nextChecklist },
      { onError: () => toast.error("Failed to update checklist") }
    );
  };

  /* -- Expanded action panel (click-to-expand), brutalist bordered row -- */
  const expandedActions = expanded && (
    <>
      <div className="border-t-[1.5px] border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-3 font-mono">
        {hasDetails || hasChecklist ? (
          <div className="space-y-3">
            {hasDetails && (
              <div className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[color:var(--ink-2)]">
                <LinkifiedText text={details} />
              </div>
            )}
            {hasChecklist && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink-3)]">
                  <span>Checklist</span>
                  <span>{doneCount}/{checklist.length}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {checklist.map((item) => (
                    <label key={item.id} className="flex items-start gap-2 text-[12px] leading-snug text-[color:var(--ink-2)]">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleChecklistToggle(item.id)}
                        disabled={isPending}
                        className="mt-0.5 h-3.5 w-3.5 border-[color:var(--line)] accent-[color:var(--accent)]"
                      />
                      <span className={item.completed ? "line-through text-[color:var(--ink-3)]" : ""}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] hover:text-[color:var(--accent)]"
          >
            <StickyNote className="h-3.5 w-3.5" />
            Add details
          </button>
        )}
      </div>
      <div
        className={`grid ${isScheduled ? "grid-cols-5" : "grid-cols-4"} gap-2 border-t-[1.5px] border-[color:var(--line)] bg-[color:var(--bg)] px-3 py-2`}
      >
        <div className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)]">
          <StartFocusButton
            actionId={action.id}
            className="!size-5 max-md:!size-8 border-0"
          />
          Focus
        </div>
        <button
          className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)] hover:text-[color:var(--accent)] active:bg-[color:var(--bg-2)]"
          onClick={handleDone}
          disabled={isPending}
        >
          <Check className="h-5 w-5 text-[color:var(--accent-3)]" />
          Done
        </button>
        <button
          className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)] hover:text-[color:var(--ink)] active:bg-[color:var(--bg-2)]"
          onClick={() => setEditOpen(true)}
          disabled={isPending}
        >
          <Pencil className="h-5 w-5" />
          Edit
        </button>
        {isScheduled && (
          <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
            <PopoverTrigger
              render={
                <button
                  className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-2)] hover:text-[color:var(--ink)] active:bg-[color:var(--bg-2)]"
                  disabled={isPending}
                >
                  <Bell className="h-5 w-5" />
                  Snooze
                </button>
              }
            />
            <PopoverContent align="center" className="w-48 p-1">
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleSnooze(15)}>15 minutes</button>
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleSnooze(30)}>30 minutes</button>
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleSnooze(60)}>1 hour</button>
              <div className="my-1 h-px bg-[color:var(--line)]" />
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleReschedule(tomorrowAt(10))}>Tomorrow, 10:00</button>
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleReschedule(tomorrowAt(14))}>Tomorrow, 14:00</button>
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => handleReschedule(tomorrowAt(18))}>Tomorrow, 18:00</button>
              <div className="my-1 h-px bg-[color:var(--line)]" />
              <button className="flex w-full items-center px-2 py-1.5 text-sm font-mono text-[color:var(--ink-2)] hover:bg-[color:var(--bg)] hover:text-[color:var(--ink)]" onClick={() => { setSnoozeOpen(false); setEditOpen(true); }}>Other…</button>
            </PopoverContent>
          </Popover>
        )}
        <button
          className="flex flex-col items-center gap-1 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--accent-2)] hover:text-[color:var(--accent-2)] active:bg-[color:var(--bg-2)]"
          onClick={() => setConfirmDelete(true)}
          disabled={isPending}
        >
          <Trash2 className="h-5 w-5" />
          Delete
        </button>
      </div>
    </>
  );

  const effectiveIso = effectiveTime;
  const timeText = isScheduled && effectiveIso
    ? format(parseISO(effectiveIso), "HH:mm").toUpperCase()
    : action.action_date
      ? "Anytime"
      : "Inbox";
  const relText = isScheduled ? relativeLabel(effectiveIso) : action.action_date ? "ANYTIME" : "SOMEDAY";
  const metaItems = [
    action.is_urgent ? "Urgent" : null,
    action.snooze_count > 0 ? `Snooze ${action.snooze_count}` : null,
    hasChecklist ? `${doneCount}/${checklist.length}` : null,
    hasDetails ? "Note" : null,
    detailsHaveUrl ? "Link" : null,
    action.task_id ? "Legacy task" : null,
    action.recurrence_rule ? recurrenceLabel(action.recurrence_rule) : null,
  ].filter((item): item is string => Boolean(item));
  const recurrenceText = action.recurrence_rule
    ? recurrenceLabel(action.recurrence_rule)
    : null;
  const hasMobileMeta =
    action.is_urgent ||
    Boolean(recurrenceText) ||
    action.snooze_count > 0 ||
    hasChecklist;

  return (
    <>
      <article
        data-done={isDone}
        className={`group border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] hover:border-[color:var(--line-2)] transition-colors ${
          isDone ? "opacity-60" : ""
        } ${expanded ? "border-[color:var(--accent)]" : ""}`}
      >
        {/* Main row — when | body | acts */}
        <div
          className="grid cursor-pointer grid-cols-[54px_minmax(0,1fr)] items-center gap-2 px-2.5 py-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:gap-3 sm:px-3 sm:py-2"
          onClick={handleRowClick}
        >
          {/* when */}
          <div className="flex min-w-0 flex-col gap-0 font-mono leading-tight">
            <span
              className={`truncate text-[11px] uppercase tracking-[1px] sm:tracking-[1.5px] ${
                action.is_urgent
                  ? "text-[color:var(--accent-2)]"
                  : "text-[color:var(--ink-2)]"
              }`}
            >
              {!isScheduled ? (
                <Pin className="h-3 w-3 inline" aria-label="floating" />
              ) : (
                timeText
              )}
            </span>
            <span className="truncate text-[10px] tracking-[0.7px] text-[color:var(--ink-3)] sm:tracking-[1px]">
              {relText}
            </span>
          </div>

          {/* body */}
          <div className={`flex min-w-0 flex-col gap-1 font-mono ${isDone ? "line-through" : ""}`}>
            <h4
              className={`m-0 text-[15px] font-normal leading-snug text-[color:var(--ink)] sm:text-[14px] ${
                expanded ? "whitespace-normal" : "line-clamp-2 sm:truncate"
              }`}
            >
              {action.title}
            </h4>
            {hasMobileMeta && (
              <div className="flex min-w-0 flex-wrap items-center gap-1 text-[10px] uppercase tracking-[1px] sm:hidden">
                {action.is_urgent && (
                  <span
                    aria-label="Urgent action"
                    className="inline-flex max-w-full items-center gap-0.5 border border-[color:var(--accent-2)] bg-transparent px-1.5 py-0.5 font-mono text-[color:var(--accent-2)]"
                  >
                    <Flag className="h-3 w-3 shrink-0" fill="currentColor" />
                    <span>Urgent</span>
                  </span>
                )}
                {recurrenceText && (
                  <span
                    aria-label={`Repeats ${recurrenceText}`}
                    className="inline-flex min-w-0 max-w-full items-center gap-0.5 border border-[color:var(--ink-3)] bg-transparent px-1.5 py-0.5 font-mono text-[color:var(--ink-3)]"
                  >
                    <Repeat className="h-3 w-3 shrink-0" />
                    <span className="truncate">{recurrenceText}</span>
                  </span>
                )}
                {action.snooze_count > 0 && (
                  <span
                    aria-label={`Snoozed ${action.snooze_count} times`}
                    className={`inline-flex max-w-full items-center gap-0.5 border bg-transparent px-1.5 py-0.5 font-mono ${snoozeBadgeClass(action.snooze_count)}`}
                  >
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Snooze {action.snooze_count}</span>
                  </span>
                )}
                {hasChecklist && (
                  <span
                    aria-label={`Checklist ${doneCount} of ${checklist.length}`}
                    className="inline-flex max-w-full items-center gap-0.5 border border-[color:var(--accent)] bg-transparent px-1.5 py-0.5 font-mono text-[color:var(--accent)]"
                  >
                    <ListChecks className="h-3 w-3 shrink-0" />
                    <span>
                      {doneCount}/{checklist.length}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="hidden min-w-[120px] items-center justify-end gap-1 font-mono text-[10px] uppercase tracking-[1px] text-[color:var(--ink-3)] sm:flex">
            {metaItems.slice(0, 4).map((item) => (
              <span
                key={item}
                className={`border px-1.5 py-0.5 ${
                  item === "Urgent"
                    ? "border-[color:var(--accent-2)] text-[color:var(--accent-2)]"
                    : item?.startsWith("Snooze")
                      ? snoozeBadgeClass(action.snooze_count)
                      : "border-[color:var(--line)]"
                }`}
              >
                {item}
              </span>
            ))}
            <span aria-hidden className="pl-1 text-[11px]">
              {expanded ? "−" : "+"}
            </span>
          </div>
        </div>

        {/* Expanded action panel */}
        {expandedActions}
      </article>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Delete action"
        description={`Are you sure you want to delete "${action.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteAction.isPending}
      />

      <EditActionDialog
        action={action}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

// -- Main list component --

interface ActionListProps {
  actions: Action[];
  today?: Date;
  isLoading: boolean;
  error: Error | null;
}

export function ActionList({ actions, today, isLoading, error }: ActionListProps) {
  const groups = useMemo(() => groupByDate(actions, today), [actions, today]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--accent-2)]">
        Failed to load actions
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]">
          <Bell className="h-5 w-5 text-[color:var(--ink-3)]" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            No actions
          </p>
          <p className="mt-1 text-[10px] font-mono text-[color:var(--ink-3)]">
            Use the form above to create your first action
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((group) => (
        <section key={group.label} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span
              className="text-[color:var(--accent)] text-[14px] leading-none"
              aria-hidden
            >
              ▍
            </span>
            <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[13px] tracking-[-0.2px] uppercase m-0 text-[color:var(--ink)]">
              {group.label}
            </h3>
            <span className="border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 py-0.5 text-[10px] text-[color:var(--ink-3)] font-mono">
              {group.actions.length}
            </span>
            <div className="flex-1 h-px bg-[color:var(--line)]" />
          </div>
          <div className="flex flex-col gap-2">
            {group.actions.map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                expanded={expandedId === action.id}
                onToggle={() => setExpandedId(expandedId === action.id ? null : action.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
