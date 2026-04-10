"use client";

import type * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Compound Select API based on @base-ui/react/select.
// Pattern matches existing ui/popover.tsx and ui/dialog.tsx wrappers.

const SelectValue = SelectPrimitive.Value;
const SelectIcon = SelectPrimitive.Icon;

// Wraps base-ui's SelectRoot for our string-keyed selects:
// - Coerces nullable onValueChange to a non-null string callback
//   (base-ui can emit `null` when no item matches; we always have one).
// - Accepts a `labels` map (forwarded to base-ui's `items` prop) so that
//   <SelectValue> displays the human-readable label of the selected value
//   instead of the raw value string.
type LabelsMap = Record<string, React.ReactNode>;

function SelectRoot({
  labels,
  onValueChange,
  ...props
}: Omit<SelectPrimitive.Root.Props<string>, "onValueChange" | "items"> & {
  labels?: LabelsMap;
  onValueChange?: (value: string) => void;
}) {
  return (
    <SelectPrimitive.Root<string>
      items={labels}
      onValueChange={(value) => onValueChange?.(value ?? "")}
      {...props}
    />
  );
}

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-foreground outline-none transition-colors",
        "focus:border-ring focus:ring-3 focus:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
        "[&>span]:truncate",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectPopup({
  className,
  children,
  align = "start",
  sideOffset = 6,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
  alignItemWithTrigger?: boolean;
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side="bottom"
        align={align}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="z-[100] outline-none"
      >
        <SelectPrimitive.Popup
          className={cn(
            "min-w-[var(--anchor-width)] max-h-[min(var(--available-height),20rem)] overflow-y-auto",
            "rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-[var(--text-primary)] shadow-xl",
            "outline-none origin-[var(--transform-origin)]",
            "transition-[opacity,transform] duration-100",
            "data-[starting-style]:opacity-0 data-[starting-style]:scale-95",
            "data-[ending-style]:opacity-0 data-[ending-style]:scale-95",
            className
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-7 text-sm outline-none",
        "text-[var(--text-primary)]",
        "data-[highlighted]:bg-[var(--surface-hover)]",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex">
        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPopup,
  SelectItem,
};
