"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, ChevronRight, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KanbanCard } from "@/types/job";
import { APPLICATION_STATUS_COLORS } from "@/types/job";

interface ApplicationCardProps {
  card: KanbanCard;
  isDragging?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ApplicationCard({ card, isDragging = false }: ApplicationCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: card.id,
    data: { card, status: card.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const accentColor = APPLICATION_STATUS_COLORS[card.status];

  const handleClick = (e: React.MouseEvent) => {
    if (transform) return;
    e.stopPropagation();
    router.push(`/jobs/${card.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`
        group relative rounded-lg border bg-card cursor-pointer transition-shadow
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
        onClick={(e) => e.stopPropagation()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-tertiary active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="px-3 py-2.5 pl-4 pr-7">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 mb-0.5">
          {card.title ?? "Untitled Position"}
        </p>

        <div className="flex items-center gap-2 mb-2">
          {card.company && (
            <p className="text-xs text-muted-foreground truncate">{card.company}</p>
          )}
          {card.match_score != null && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                card.match_score >= 80
                  ? "bg-accent-teal-muted text-accent-teal"
                  : card.match_score >= 60
                  ? "bg-accent-amber-muted text-accent-amber"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {card.match_score}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          {card.applied_date && (
            <div className="flex items-center gap-1 text-[11px] text-tertiary">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Applied {formatDate(card.applied_date)}</span>
            </div>
          )}

          {card.next_action && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-tertiary" />
              <span className="truncate">{card.next_action}</span>
              {card.next_action_date && (
                <span className="flex-shrink-0 text-tertiary">
                  · {formatDate(card.next_action_date)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ApplicationCardOverlay({ card }: { card: KanbanCard }) {
  const accentColor = APPLICATION_STATUS_COLORS[card.status];

  return (
    <div className="relative rounded-lg border border-primary bg-card shadow-xl cursor-grabbing">
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="px-3 py-2.5 pl-4">
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {card.title ?? "Untitled Position"}
        </p>
        {card.company && (
          <p className="text-xs text-muted-foreground mt-0.5">{card.company}</p>
        )}
      </div>
    </div>
  );
}
