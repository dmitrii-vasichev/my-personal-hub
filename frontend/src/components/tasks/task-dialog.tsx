"use client";

import { useState } from "react";
import { Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PriorityPicker } from "./priority-picker";
import { VisibilityPicker } from "./visibility-picker";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChecklistEditor } from "./checklist-editor";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useCreateTask } from "@/hooks/use-tasks";
import { TagPicker } from "./tag-picker";
import type { ChecklistItem, TaskPriority, TaskStatus, Visibility } from "@/types/task";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/types/task";

const pad2 = (n: number) => String(n).padStart(2, "0");

function withTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}:00${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

interface TaskDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialStatus?: TaskStatus;
}

export function TaskDialog({ onClose, onSuccess, initialStatus }: TaskDialogProps) {
  const createTask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(initialStatus ?? "new");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("family");
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isLoading = createTask.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      const isFloating = reminderDate !== "" && reminderTime === "";
      const reminderAt = reminderDate
        ? isFloating
          ? withTzOffset(reminderDate, "00:00")
          : withTzOffset(reminderDate, reminderTime)
        : undefined;

      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        deadline: deadline || undefined,
        reminder_at: reminderAt,
        reminder_floating: reminderAt ? isFloating : undefined,
        checklist,
        visibility,
        tag_ids: tagIds.length > 0 ? tagIds : undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6">
          <DialogClose />

          <DialogTitle className="mb-5">
            New Task
          </DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description…"
                rows={3}
              />
            </div>

            {/* Status + Priority + Visibility */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Status
                </Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {TASK_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Priority
                </Label>
                <PriorityPicker value={priority} onChange={setPriority} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Visibility
                </Label>
                <VisibilityPicker value={visibility} onChange={setVisibility} />
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Tags
              </Label>
              <TagPicker selectedTagIds={tagIds} onChange={setTagIds} />
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Deadline
              </Label>
              <DatePicker
                value={deadline}
                onChange={setDeadline}
                placeholder="No deadline"
                clearable
              />
            </div>

            {/* Reminder */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Reminder
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DatePicker
                    value={reminderDate}
                    onChange={(v) => { setReminderDate(v); if (!v) setReminderTime(""); }}
                    placeholder="No reminder"
                    clearable
                  />
                </div>
                {reminderDate && (
                  reminderTime ? (
                    <div className="flex items-center gap-1">
                      <TimePicker value={reminderTime} onChange={setReminderTime} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setReminderTime("")}
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
                      onClick={() => setReminderTime("09:00")}
                    >
                      <Clock className="h-4 w-4 opacity-60 shrink-0" />
                      <span className="text-sm">Add time</span>
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Checklist
              </Label>
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
