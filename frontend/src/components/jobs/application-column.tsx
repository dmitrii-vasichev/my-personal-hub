"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ApplicationStatus, KanbanCard } from "@/types/job";
import { APPLICATION_STATUS_LABELS } from "@/types/job";
import { ApplicationCard } from "./application-card";

interface ApplicationColumnProps {
  status: ApplicationStatus;
  cards: KanbanCard[];
  activeCardId: number | null;
}

// Brutalist accent per status (marker + border hints).
const STATUS_ACCENT: Record<ApplicationStatus, string> = {
  found: "var(--ink-3)",
  saved: "var(--ink-3)",
  resume_generated: "var(--ink-3)",
  applied: "var(--ink)",
  screening: "var(--ink)",
  technical_interview: "var(--accent-2)",
  final_interview: "var(--accent-2)",
  offer: "var(--accent-3)",
  accepted: "var(--accent-3)",
  rejected: "var(--ink-4)",
  ghosted: "var(--ink-4)",
  withdrawn: "var(--ink-4)",
};

export function ApplicationColumn({
  status,
  cards,
  activeCardId,
}: ApplicationColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const accent = STATUS_ACCENT[status];

  return (
    <div className="flex w-64 flex-shrink-0 flex-col gap-2">
      {/* Column header · brutalist */}
      <div className="flex items-center gap-2 px-1 font-mono">
        <span
          className="h-2 w-2 flex-shrink-0"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[color:var(--ink-2)] truncate">
          {APPLICATION_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 text-[10px] text-[color:var(--ink-3)] font-mono">
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex min-h-20 flex-col gap-2 p-1 transition-colors
          ${isOver ? "outline outline-2 outline-[color:var(--accent)] outline-offset-[-2px]" : ""}
        `}
      >
        {cards.map((card) => (
          <ApplicationCard
            key={card.id}
            card={card}
            isDragging={card.id === activeCardId}
          />
        ))}

        {cards.length === 0 && (
          <div className="flex h-14 items-center justify-center border border-dashed border-[color:var(--line)] text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            No applications
          </div>
        )}
      </div>
    </div>
  );
}
