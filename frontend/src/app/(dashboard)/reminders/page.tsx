"use client";

import { useState } from "react";
import { Bell, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { RemindersTabs } from "@/components/reminders/reminders-tabs";
import { QuickAddForm } from "@/components/reminders/quick-add-form";
import { ReminderList } from "@/components/reminders/reminder-list";
import { CompletedRemindersSheet } from "@/components/reminders/completed-reminders-sheet";
import { useReminders } from "@/hooks/use-reminders";

export default function RemindersPage() {
  const { data: reminders = [], isLoading, error } = useReminders();
  const [completedOpen, setCompletedOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Reminders</h1>
        </div>
        <Tooltip content="Completed reminders">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCompletedOpen(true)}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
          </Button>
        </Tooltip>
      </div>

      {/* Tab navigation */}
      <RemindersTabs />

      {/* Quick-add form */}
      <QuickAddForm />

      {/* Reminder list grouped by date */}
      <ReminderList
        reminders={reminders}
        isLoading={isLoading}
        error={error}
      />

      <CompletedRemindersSheet
        open={completedOpen}
        onOpenChange={setCompletedOpen}
      />
    </div>
  );
}
