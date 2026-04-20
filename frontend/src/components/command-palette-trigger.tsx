"use client";

import { useCommandPalette } from "@/hooks/use-command-palette";

export function CommandPaletteTrigger() {
  const { setOpen } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-[8px] h-7 px-[10px] border border-[color:var(--line)] bg-transparent text-[10.5px] tracking-[0.5px] text-[color:var(--ink-2)] hover:text-[color:var(--ink)] hover:border-[color:var(--ink)] transition-colors"
      aria-label="Open command palette"
    >
      <span className="text-[color:var(--accent)]">▸</span>
      <span className="uppercase">search</span>
      <span className="hidden sm:inline text-[color:var(--ink-3)] ml-[4px]">⌘K</span>
    </button>
  );
}
