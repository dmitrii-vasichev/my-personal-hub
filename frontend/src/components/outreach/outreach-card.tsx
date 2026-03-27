"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Mail, Phone } from "lucide-react";
import type { LeadKanbanCard } from "@/types/lead";
import { LEAD_STATUS_COLORS } from "@/types/lead";

interface OutreachCardProps {
  card: LeadKanbanCard;
  isDragging?: boolean;
  onClick?: (cardId: number) => void;
}

export function OutreachCard({ card, isDragging = false, onClick }: OutreachCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
    data: { card, status: card.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const accentColor = LEAD_STATUS_COLORS[card.status];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-lg border bg-card transition-shadow
        ${
          isDragging
            ? "shadow-lg opacity-50 border-border"
            : "border-border-subtle hover:border-border"
        }
      `}
    >
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      <div
        {...listeners}
        {...attributes}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-tertiary active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div
        className="px-3 py-2.5 pl-4 pr-7 cursor-pointer"
        onClick={() => onClick?.(card.id)}
      >
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-0.5">
          {card.business_name}
        </p>

        {card.contact_person && (
          <p className="text-xs text-muted-foreground truncate mb-1.5">
            {card.contact_person}
          </p>
        )}

        <div className="flex flex-col gap-1">
          {card.email && (
            <div className="flex items-center gap-1 text-[11px] text-tertiary">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{card.email}</span>
            </div>
          )}
          {card.phone && (
            <div className="flex items-center gap-1 text-[11px] text-tertiary">
              <Phone className="h-3 w-3 flex-shrink-0" />
              <span>{card.phone}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function OutreachCardOverlay({ card }: { card: LeadKanbanCard }) {
  const accentColor = LEAD_STATUS_COLORS[card.status];

  return (
    <div className="relative rounded-lg border border-primary bg-card shadow-xl cursor-grabbing">
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="px-3 py-2.5 pl-4">
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {card.business_name}
        </p>
        {card.contact_person && (
          <p className="text-xs text-muted-foreground mt-0.5">{card.contact_person}</p>
        )}
      </div>
    </div>
  );
}
