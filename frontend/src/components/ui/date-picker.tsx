"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarDays, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string or empty string */
  value: string;
  /** Called with YYYY-MM-DD string or empty string when cleared */
  onChange: (value: string) => void;
  /** Placeholder when no date is selected */
  placeholder?: string;
  /** Show clear button */
  clearable?: boolean;
  /** Only pick month + day; year is irrelevant (stored as 2000) */
  monthDayOnly?: boolean;
  /** Additional class for the trigger button */
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  clearable = false,
  monthDayOnly = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [defaultDate, setDefaultDate] = React.useState(() => new Date());

  const REFERENCE_YEAR = 2000;

  const date = React.useMemo(
    () => (value ? parse(value, "yyyy-MM-dd", new Date()) : undefined),
    [value]
  );
  const selectedDate = date ?? defaultDate;

  const displayText = date
    ? format(date, monthDayOnly ? "MMM d" : "MMM d, yyyy")
    : null;

  // Sync input field when popover opens
  React.useEffect(() => {
    if (open) {
      setDefaultDate(new Date());
      setInputValue(
        date ? format(date, monthDayOnly ? "dd.MM" : "dd.MM.yyyy") : ""
      );
    }
  }, [open, date, monthDayOnly]);

  function emitDate(day: Date) {
    if (monthDayOnly) {
      // Normalize year so the stored value is always REFERENCE_YEAR
      const normalized = new Date(REFERENCE_YEAR, day.getMonth(), day.getDate());
      onChange(format(normalized, "yyyy-MM-dd"));
    } else {
      onChange(format(day, "yyyy-MM-dd"));
    }
  }

  function handleSelect(day: Date | undefined) {
    if (day) {
      emitDate(day);
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;
    const digits = v.replace(/\D/g, "");

    if (monthDayOnly) {
      // Auto-insert dot: "01" -> "01."
      if (digits.length >= 2 && !v.includes(".")) {
        v = digits.slice(0, 2) + "." + digits.slice(2);
      }
      // Limit to DD.MM
      if (digits.length > 4) return;
    } else {
      // Auto-insert dots: "01" -> "01.", "01.12" -> "01.12."
      if (digits.length >= 2 && !v.includes(".")) {
        v = digits.slice(0, 2) + "." + digits.slice(2);
      } else if (digits.length >= 4 && v.split(".").length < 3) {
        v = digits.slice(0, 2) + "." + digits.slice(2, 4) + "." + digits.slice(4);
      }
      // Limit to DD.MM.YYYY
      if (digits.length > 8) return;
    }

    setInputValue(v);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      tryApplyInput(true);
    }
  }

  function handleInputBlur() {
    // Only apply value — do NOT close popover.
    // Closing on blur causes a race condition: the popover unmounts
    // before the DayPicker onSelect callback can fire, so calendar
    // day clicks are silently swallowed.
    tryApplyInput(false);
  }

  function tryApplyInput(close: boolean) {
    if (!inputValue.trim()) return;

    if (monthDayOnly) {
      const parsed = parse(
        inputValue + "." + REFERENCE_YEAR,
        "dd.MM.yyyy",
        new Date()
      );
      if (isValid(parsed)) {
        emitDate(parsed);
        if (close) setOpen(false);
      }
    } else {
      const parsed = parse(inputValue, "dd.MM.yyyy", new Date());
      if (isValid(parsed) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
        onChange(format(parsed, "yyyy-MM-dd"));
        if (close) setOpen(false);
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal w-full",
              !displayText && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarDays className="h-4 w-4 opacity-60" />
        {displayText || placeholder}
        {clearable && value && (
          <span
            role="button"
            onClick={handleClear}
            className="ml-auto text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <div className="px-3 pt-3 pb-1">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            placeholder={monthDayOnly ? "DD.MM" : "DD.MM.YYYY"}
            className="h-8 text-base md:text-sm"
          />
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate}
          required
        />
      </PopoverContent>
    </Popover>
  );
}
