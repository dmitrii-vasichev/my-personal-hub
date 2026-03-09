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
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

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

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const [h24, min] = React.useMemo(() => {
    if (!value) return [9, 0];
    const [hh, mm] = value.split(":").map(Number);
    return [isNaN(hh) ? 9 : hh, isNaN(mm) ? 0 : mm];
  }, [value]);

  const { h: hour12, period } = to12h(h24);
  const display = `${pad(hour12)}:${pad(min)} ${period}`;

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
        <div className="flex gap-1 h-[200px]">
          <ScrollColumn
            items={HOURS_12}
            selected={hour12}
            onSelect={(h) => emit(to24h(h, period), min)}
            format={pad}
          />
          <ScrollColumn
            items={MINUTES}
            selected={min}
            onSelect={(m) => emit(h24, m)}
            format={pad}
          />
          <ScrollColumn
            items={["AM" as const, "PM" as const]}
            selected={period}
            onSelect={(p) => emit(to24h(hour12, p), min)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScrollColumn<T extends string | number>({
  items,
  selected,
  onSelect,
  format,
}: {
  items: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  format?: (v: T) => string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selectedRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }
  });

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto w-14 flex flex-col gap-0.5"
    >
      {items.map((item) => {
        const isSel = item === selected;
        const label = format ? format(item) : String(item);
        return (
          <button
            key={String(item)}
            ref={isSel ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full rounded-md px-2 py-1.5 text-sm text-center transition-colors cursor-pointer shrink-0",
              isSel
                ? "bg-accent-foreground/15 text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
