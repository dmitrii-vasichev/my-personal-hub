"use client";

import { Bell } from "lucide-react";
import { QuickAddForm } from "@/components/reminders/quick-add-form";
import { ReminderList } from "@/components/reminders/reminder-list";
import { useReminders } from "@/hooks/use-reminders";

export default function RemindersPage() {
  const { data: reminders = [], isLoading, error } = useReminders();

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Reminders</h1>
        </div>
      </div>

      {/* Quick-add form */}
      <QuickAddForm />

      {/* Reminder list grouped by date */}
      <ReminderList
        reminders={reminders}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
