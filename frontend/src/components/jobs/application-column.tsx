"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ApplicationStatus, KanbanCard } from "@/types/job";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_COLORS } from "@/types/job";
import { ApplicationCard } from "./application-card";

interface ApplicationColumnProps {
  status: ApplicationStatus;
  cards: KanbanCard[];
  activeCardId: number | null;
}

export function ApplicationColumn({ status, cards, activeCardId }: ApplicationColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const accentColor = APPLICATION_STATUS_COLORS[status];

  return (
    <div className="flex w-64 flex-shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span
          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-[#6b7280] truncate">
          {APPLICATION_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded bg-[#171b26] px-1.5 text-[11px] font-medium text-[#4b5563]">
          {cards.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex min-h-20 flex-col gap-2 rounded-lg p-1 transition-colors
          ${isOver ? "bg-[#1e2333] ring-1 ring-[#4f8ef7]" : ""}
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
          <div className="flex h-14 items-center justify-center rounded border border-dashed border-[#252a3a] text-xs text-[#374151]">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}
