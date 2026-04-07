"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useCreateBirthday } from "@/hooks/use-birthdays";

export function BirthdayAddForm() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [advanceDays, setAdvanceDays] = useState("3");
  const [reminderTime, setReminderTime] = useState("10:00");
  const createBirthday = useCreateBirthday();

  const canSubmit = name.trim().length > 0 && birthDate.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createBirthday.mutate(
      {
        name: name.trim(),
        birth_date: birthDate,
        advance_days: parseInt(advanceDays, 10) || 3,
        reminder_time: reminderTime || "10:00",
      },
      {
        onSuccess: () => {
          setName("");
          setBirthDate("");
          setAdvanceDays("3");
          setReminderTime("10:00");
          toast.success("Birthday added");
        },
        onError: () => toast.error("Failed to add birthday"),
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
    >
      {/* Name */}
      <div className="flex min-w-[200px] flex-1 flex-col gap-1">
        <label
          htmlFor="birthday-name"
          className="text-xs font-medium text-muted-foreground"
        >
          Name
        </label>
        <Input
          id="birthday-name"
          placeholder="e.g. Mom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Birth date */}
      <div className="flex min-w-[180px] flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Birth date
        </label>
        <DatePicker
          value={birthDate}
          onChange={setBirthDate}
          placeholder="Select date"
        />
      </div>

      {/* Advance days */}
      <div className="flex w-[100px] flex-col gap-1">
        <label
          htmlFor="birthday-advance"
          className="text-xs font-medium text-muted-foreground"
        >
          Days before
        </label>
        <Input
          id="birthday-advance"
          type="number"
          min={0}
          max={30}
          value={advanceDays}
          onChange={(e) => setAdvanceDays(e.target.value)}
        />
      </div>

      {/* Reminder time */}
      <div className="flex w-[110px] flex-col gap-1">
        <label
          htmlFor="birthday-time"
          className="text-xs font-medium text-muted-foreground"
        >
          Remind at
        </label>
        <Input
          id="birthday-time"
          type="time"
          value={reminderTime}
          onChange={(e) => setReminderTime(e.target.value)}
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        size="default"
        disabled={!canSubmit || createBirthday.isPending}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {createBirthday.isPending ? "Adding..." : "Add"}
      </Button>
    </form>
  );
}
