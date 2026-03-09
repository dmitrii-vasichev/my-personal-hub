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
  /** Additional class for the trigger button */
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  clearable = false,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  const displayText = date
    ? format(date, "MMM d, yyyy")
    : null;

  // Sync input field when popover opens
  React.useEffect(() => {
    if (open) {
      setInputValue(date ? format(date, "dd.MM.yyyy") : "");
    }
  }, [open, date]);

  function handleSelect(day: Date | undefined) {
    if (day) {
      onChange(format(day, "yyyy-MM-dd"));
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value;

    // Auto-insert dots: "01" -> "01.", "01.12" -> "01.12."
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 2 && !v.includes(".")) {
      v = digits.slice(0, 2) + "." + digits.slice(2);
    } else if (digits.length >= 4 && v.split(".").length < 3) {
      v = digits.slice(0, 2) + "." + digits.slice(2, 4) + "." + digits.slice(4);
    }

    // Limit to DD.MM.YYYY
    if (v.replace(/\D/g, "").length > 8) return;
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
    const parsed = parse(inputValue, "dd.MM.yyyy", new Date());
    if (isValid(parsed) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
      onChange(format(parsed, "yyyy-MM-dd"));
      if (close) setOpen(false);
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
            placeholder="DD.MM.YYYY"
            className="h-8 text-sm"
          />
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  );
}
