"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useCreateTask } from "@/hooks/use-tasks";
import type { ChecklistItem, TaskPriority, Visibility } from "@/types/task";

interface TaskDialogProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskDialog({ onClose, onSuccess }: TaskDialogProps) {
  const createTask = useCreateTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [deadline, setDeadline] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("family");
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
      await createTask.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        deadline: deadline || undefined,
        reminder_at: reminderAt || undefined,
        checklist,
        visibility,
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

            {/* Priority + Visibility */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priority" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Priority
                </Label>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="visibility" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Visibility
                </Label>
                <Select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                >
                  <option value="family">Family</option>
                  <option value="private">Private</option>
                </Select>
              </div>
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
              <DateTimePicker
                value={reminderAt}
                onChange={setReminderAt}
                placeholder="No reminder"
                clearable
              />
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
