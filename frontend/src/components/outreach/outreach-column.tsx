"use client";

import { useDroppable } from "@dnd-kit/core";
import type { LeadKanbanCard, LeadStatus } from "@/types/lead";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/types/lead";
import { OutreachCard } from "./outreach-card";

interface OutreachColumnProps {
  status: LeadStatus;
  cards: LeadKanbanCard[];
  activeCardId: number | null;
  onCardClick?: (cardId: number) => void;
}

export function OutreachColumn({ status, cards, activeCardId, onCardClick }: OutreachColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const accentColor = LEAD_STATUS_COLORS[status];

  return (
    <div className="flex w-64 flex-shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">
          {LEAD_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded bg-surface px-1.5 text-[11px] font-medium text-tertiary">
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex min-h-20 flex-col gap-2 rounded-lg p-1 transition-colors
          ${isOver ? "bg-surface-hover ring-1 ring-primary" : ""}
        `}
      >
        {cards.map((card) => (
          <OutreachCard
            key={card.id}
            card={card}
            isDragging={card.id === activeCardId}
            onClick={onCardClick}
          />
        ))}

        {cards.length === 0 && (
          <div className="flex h-14 items-center justify-center rounded border border-dashed border-border-subtle text-xs text-tertiary">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}
