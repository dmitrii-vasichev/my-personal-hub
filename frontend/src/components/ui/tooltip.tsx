"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

interface TooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  portal?: boolean;
  children: React.ReactElement;
}

export function Tooltip({ content, side = "top", delay = 300, portal = true, children }: TooltipProps) {
  if (!content) return children;

  const positioner = (
    <TooltipPrimitive.Positioner side={side} sideOffset={6}>
      <TooltipPrimitive.Popup
        className="z-[9999] rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-primary)] shadow-md transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
      >
        {content}
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  );

  return (
    <TooltipPrimitive.Provider delay={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger render={children} />
        {portal ? (
          <TooltipPrimitive.Portal>{positioner}</TooltipPrimitive.Portal>
        ) : (
          positioner
        )}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
