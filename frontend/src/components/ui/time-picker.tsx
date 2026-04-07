"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface TimePickerProps {
  /** Time value as "HH:MM" (24h format) string */
  value: string;
  /** Called with "HH:MM" (24h format) string */
  onChange: (value: string) => void;
  className?: string;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => i * 5);

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function to12h(h24: number): { h: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return { h, period };
}

function to24h(h12: number, period: "AM" | "PM"): number {
  if (period === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

function nearestFive(m: number): number {
  return Math.round(m / 5) * 5 % 60;
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const [h24, min] = React.useMemo(() => {
    if (!value) return [9, 0];
    const [hh, mm] = value.split(":").map(Number);
    return [isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm];
  }, [value]);

  const { h: hour12, period } = to12h(h24);
  const display = `${pad(hour12)}:${pad(nearestFive(min))} ${period}`;

  function emit(newH24: number, newMin: number) {
    onChange(`${pad(newH24)}:${pad(newMin)}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal shrink-0",
              className
            )}
          />
        }
      >
        <Clock className="h-4 w-4 opacity-60 shrink-0" />
        <span className="text-sm">{display}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        {/* AM / PM toggle */}
        <div className="flex gap-1 mb-2">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => emit(to24h(hour12, p), nearestFive(min))}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-sm text-center transition-colors cursor-pointer",
                p === period
                  ? "bg-accent-foreground/15 text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Hours grid 4×3 */}
        <div className="grid grid-cols-4 gap-1">
          {HOURS_12.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => emit(to24h(h, period), nearestFive(min))}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm text-center transition-colors cursor-pointer",
                h === hour12
                  ? "bg-accent-foreground/15 text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {pad(h)}
            </button>
          ))}
        </div>

        <div className="border-t my-1.5" />

        {/* Minutes grid 4×3, step 5 */}
        <div className="grid grid-cols-4 gap-1">
          {MINUTES_5.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => emit(h24, m)}
              className={cn(
                "rounded-md px-2 py-1.5 text-sm text-center transition-colors cursor-pointer",
                nearestFive(min) === m
                  ? "bg-accent-foreground/15 text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {pad(m)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
