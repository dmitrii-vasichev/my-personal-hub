"use client";

import { useState } from "react";
import { Clock, Flag, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateAction } from "@/hooks/use-actions";
import { localDateString, withLocalTzOffset } from "./today-action-utils";

export function QuickAddTodayActionForm() {
  const [title, setTitle] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [time, setTime] = useState("09:00");
  const [isUrgent, setIsUrgent] = useState(false);
  const createAction = useCreateAction();

  const canSubmit = title.trim().length > 0;

  const reset = () => {
    setTitle("");
    setHasTime(false);
    setTime("09:00");
    setIsUrgent(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || createAction.isPending) return;

    const today = localDateString();

    createAction.mutate(
      {
        title: title.trim(),
        action_date: today,
        remind_at: hasTime ? withLocalTzOffset(today, time) : undefined,
        is_urgent: isUrgent,
      },
      {
        onSuccess: reset,
      }
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-[color:var(--line-2)] bg-card/40 p-2 font-mono sm:p-2.5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to happen today?"
          autoComplete="off"
          className="min-h-9 flex-1 border-0 bg-transparent px-1 text-[16px] shadow-none rounded-none placeholder:text-[color:var(--ink-3)] focus-visible:ring-0 md:text-[13px]"
        />

        <div className="flex items-center gap-1.5 sm:shrink-0">
          {hasTime ? (
            <div className="flex items-center gap-1">
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value || "09:00")}
                aria-label="Reminder time"
                className="h-9 w-[104px] rounded-none font-mono text-[13px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setHasTime(false);
                  setTime("09:00");
                }}
                title="Remove time"
                aria-label="Remove time"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setTime("09:00");
                setHasTime(true);
              }}
              className="h-9 gap-1.5 px-2.5"
            >
              <Clock className="h-4 w-4" />
              Add time
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsUrgent((current) => !current)}
            className={`h-9 w-9 shrink-0 ${
              isUrgent
                ? "border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:text-red-600"
                : ""
            }`}
            title={isUrgent ? "Remove urgent" : "Mark as urgent"}
            aria-label={isUrgent ? "Remove urgent" : "Mark as urgent"}
          >
            <Flag className="h-4 w-4" fill={isUrgent ? "currentColor" : "none"} />
          </Button>

          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || createAction.isPending}
            className="h-9 shrink-0 gap-1.5 px-3"
          >
            <Plus className="h-4 w-4" />
            {createAction.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </form>
  );
}
