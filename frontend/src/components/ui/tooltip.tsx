"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

interface TooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  children: React.ReactElement;
}

export function Tooltip({ content, side = "top", delay = 300, children }: TooltipProps) {
  if (!content) return children;

  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children} />
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner side={side} sideOffset={6}>
            <TooltipPrimitive.Popup
              className="z-[9999] rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-md transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
