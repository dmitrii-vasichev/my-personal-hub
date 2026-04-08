"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useCreateBirthday } from "@/hooks/use-birthdays";

export function BirthdayAddForm() {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [advanceDays, setAdvanceDays] = useState("3");
  const [reminderTime, setReminderTime] = useState("10:00");
  const [expanded, setExpanded] = useState(false);
  const createBirthday = useCreateBirthday();

  const canSubmit = name.trim().length > 0 && birthDate.length > 0;

  const collapse = () => {
    setExpanded(false);
    setName("");
    setBirthDate("");
    setBirthYear("");
    setAdvanceDays("3");
    setReminderTime("10:00");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const yearNum = birthYear ? parseInt(birthYear, 10) : null;

    createBirthday.mutate(
      {
        name: name.trim(),
        birth_date: birthDate,
        birth_year: yearNum && yearNum > 1900 && yearNum <= new Date().getFullYear() ? yearNum : null,
        advance_days: parseInt(advanceDays, 10) || 3,
        reminder_time: reminderTime || "10:00",
      },
      {
        onSuccess: () => {
          collapse();
          toast.success("Birthday added");
        },
        onError: () => toast.error("Failed to add birthday"),
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-card p-4"
    >
      {/* Name row — always visible */}
      <div className="flex items-center gap-2">
        <Input
          id="birthday-name"
          placeholder="Whose birthday?"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setExpanded(true)}
          autoComplete="off"
          className="flex-1"
        />
        {expanded && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
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
          <div className="flex flex-col gap-3 pt-3 md:flex-row md:flex-wrap md:items-end">
            {/* Birth date + Year — side by side on mobile */}
            <div className="grid grid-cols-2 gap-3 md:contents">
              <div className="flex flex-col gap-1 md:min-w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">
                  Birth date
                </label>
                <DatePicker
                  value={birthDate}
                  onChange={setBirthDate}
                  placeholder="Select date"
                />
              </div>

              <div className="flex flex-col gap-1 md:w-[100px]">
                <label
                  htmlFor="birthday-year"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Year (optional)
                </label>
                <Input
                  id="birthday-year"
                  type="number"
                  min={1900}
                  max={new Date().getFullYear()}
                  placeholder="e.g. 1990"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                />
              </div>
            </div>

            {/* Advance days + Time + Add */}
            <div className="flex items-end gap-3 md:contents">
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

              <div className="flex flex-col gap-1 md:min-w-[130px]">
                <label className="text-xs font-medium text-muted-foreground">
                  Remind at
                </label>
                <TimePicker
                  value={reminderTime}
                  onChange={setReminderTime}
                />
              </div>

              <Button
                type="submit"
                size="default"
                disabled={!canSubmit || createBirthday.isPending}
                className="shrink-0 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                {createBirthday.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
