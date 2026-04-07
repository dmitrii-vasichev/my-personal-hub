"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useReminders, useSnoozeReminder, useMarkDone } from "@/hooks/use-reminders";
import type { Reminder } from "@/types/reminder";

/**
 * Background poller that shows browser toasts for due reminders.
 * Mounted once in AppShell — renders nothing.
 */
export function ReminderPoller() {
  const router = useRouter();
  const { data: reminders } = useReminders(false); // only pending
  const snoozeMutation = useSnoozeReminder();
  const markDoneMutation = useMarkDone();

  // Track which reminder IDs we've already toasted to avoid duplicates
  const shownIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!reminders?.length) return;

    const now = new Date();
    const horizon = new Date(now.getTime() + 15 * 60 * 1000); // +15 min

    const dueReminders = reminders.filter((r: Reminder) => {
      const remindAt = new Date(r.remind_at);
      return r.status === "pending" && remindAt <= horizon;
    });

    for (const reminder of dueReminders) {
      if (shownIds.current.has(reminder.id)) continue;
      shownIds.current.add(reminder.id);

      const toastId = `reminder-${reminder.id}`;
      toast(reminder.title, {
        id: toastId,
        description: reminder.task_title
          ? `Task: ${reminder.task_title}`
          : `Due: ${new Date(reminder.remind_at).toLocaleString()}`,
        icon: <Bell size={14} className="text-accent-amber" />,
        duration: Infinity,
        action: {
          label: "Done",
          onClick: () => {
            markDoneMutation.mutate(reminder.id);
          },
        },
        cancel: {
          label: "Snooze 10m",
          onClick: () => {
            snoozeMutation.mutate({ id: reminder.id, minutes: 10 });
            shownIds.current.delete(reminder.id);
          },
        },
        onDismiss: () => {
          // Dismiss just hides the toast; reminder stays pending
          // Will re-show on next poll cycle if still due
          shownIds.current.delete(reminder.id);
        },
      });
    }
  }, [reminders, router, snoozeMutation, markDoneMutation]);

  return null;
}
