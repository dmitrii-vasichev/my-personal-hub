"use client";

import * as React from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

interface DateTimePickerProps {
  /** Value as "YYYY-MM-DDTHH:MM" string or empty string */
  value: string;
  /** Called with "YYYY-MM-DDTHH:MM" string or empty string when cleared */
  onChange: (value: string) => void;
  /** Placeholder for the date part */
  placeholder?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Additional class */
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date & time",
  clearable = false,
  className,
}: DateTimePickerProps) {
  // Split value into date part and time part
  const datePart = value ? value.split("T")[0] : "";
  const timePart =
    value && value.includes("T") ? value.split("T")[1].slice(0, 5) : "";

  function handleDateChange(newDate: string) {
    if (!newDate) {
      onChange("");
      return;
    }
    const time = timePart || "09:00";
    onChange(`${newDate}T${time}`);
  }

  function handleTimeChange(newTime: string) {
    if (!newTime) return;
    const date = datePart || format(new Date(), "yyyy-MM-dd");
    onChange(`${date}T${newTime}`);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1">
        <DatePicker
          value={datePart}
          onChange={handleDateChange}
          placeholder={placeholder}
          clearable={clearable}
        />
      </div>
      <TimePicker value={timePart || "09:00"} onChange={handleTimeChange} />
    </div>
  );
}
