"use client";

import { Search } from "lucide-react";
import { useCommandPalette } from "@/hooks/use-command-palette";

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex h-9 w-9 items-center justify-center border border-[color:var(--line)] bg-transparent text-[10.5px] tracking-[0.5px] text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--ink)] hover:text-[color:var(--ink)] md:h-7 md:w-auto md:gap-[8px] md:px-[10px]"
      aria-label="Open command palette"
    >
      <Search className="h-4 w-4 md:hidden" />
      <span className="hidden text-[color:var(--accent)] md:inline">▸</span>
      <span className="hidden uppercase md:inline">search</span>
      <span className="hidden sm:inline text-[color:var(--ink-3)] ml-[4px]">⌘K</span>
    </button>
  );
}
