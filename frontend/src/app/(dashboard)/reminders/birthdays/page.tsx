"use client";

import { Cake } from "lucide-react";
import { RemindersTabs } from "@/components/reminders/reminders-tabs";
import { BirthdayAddForm } from "@/components/reminders/birthday-add-form";
import { BirthdayList } from "@/components/reminders/birthday-list";
import { useBirthdays } from "@/hooks/use-birthdays";

export default function BirthdaysPage() {
  const { data: birthdays = [], isLoading, error } = useBirthdays();

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cake className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Birthdays</h1>
        </div>
      </div>

      {/* Tab navigation */}
      <RemindersTabs />

      {/* Add form */}
      <BirthdayAddForm />

      {/* Birthday list */}
      <BirthdayList
        birthdays={birthdays}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
