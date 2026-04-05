"use client";

import * as React from "react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Parse any datetime string (naive or with timezone) into local date/time parts. */
function toLocalParts(value: string): { datePart: string; timePart: string } {
  if (!value) return { datePart: "", timePart: "" };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { datePart: "", timePart: "" };
  return {
    datePart: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timePart: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/** Build an ISO string with the browser's local timezone offset. */
function withTzOffset(date: string, time: string): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${date}T${time}${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

interface DateTimePickerProps {
  /** Value as ISO datetime string (with or without timezone) or empty string */
  value: string;
  /** Called with ISO datetime string (with timezone offset) or empty string when cleared */
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
  const { datePart, timePart } = toLocalParts(value);

  function handleDateChange(newDate: string) {
    if (!newDate) {
      onChange("");
      return;
    }
    const time = timePart || "09:00";
    onChange(withTzOffset(newDate, time));
  }

  function handleTimeChange(newTime: string) {
    if (!newTime) return;
    const date = datePart || format(new Date(), "yyyy-MM-dd");
    onChange(withTzOffset(date, newTime));
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
