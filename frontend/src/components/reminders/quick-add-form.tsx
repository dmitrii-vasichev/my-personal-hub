"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useCreateReminder } from "@/hooks/use-reminders";

export function QuickAddForm() {
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const createReminder = useCreateReminder();

  const canSubmit = title.trim().length > 0 && remindAt.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createReminder.mutate(
      { title: title.trim(), remind_at: remindAt },
      {
        onSuccess: () => {
          setTitle("");
          setRemindAt("");
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

      {/* Date & Time */}
      <div className="flex min-w-[260px] flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Date & Time
        </label>
        <DateTimePicker
          value={remindAt}
          onChange={setRemindAt}
          placeholder="Pick date & time"
        />
      </div>

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
