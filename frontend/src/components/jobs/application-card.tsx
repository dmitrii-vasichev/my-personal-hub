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
    // Don't navigate if the user is dragging
    if (transform) return;
    e.stopPropagation();
    router.push(`/jobs/applications/${card.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`
        group relative rounded-lg border bg-[#171b26] cursor-pointer transition-shadow
        ${
          isDragging
            ? "shadow-lg opacity-50 border-[#374151]"
            : "border-[#252a3a] hover:border-[#374151]"
        }
      `}
    >
      {/* Status accent border on left */}
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />

      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[#4b5563] active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="px-3 py-2.5 pl-4 pr-7">
        {/* Job title */}
        <p className="text-sm font-medium text-[#e8eaf0] leading-snug line-clamp-2 mb-0.5">
          {card.job?.title ?? "Untitled Position"}
        </p>

        {/* Company */}
        {card.job?.company && (
          <p className="text-xs text-[#6b7280] mb-2 truncate">{card.job.company}</p>
        )}

        {/* Applied date + next action */}
        <div className="flex flex-col gap-1">
          {card.applied_date && (
            <div className="flex items-center gap-1 text-[11px] text-[#4b5563]">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>Applied {formatDate(card.applied_date)}</span>
            </div>
          )}

          {card.next_action && (
            <div className="flex items-center gap-1 text-[11px] text-[#6b7280]">
              <ChevronRight className="h-3 w-3 flex-shrink-0 text-[#4b5563]" />
              <span className="truncate">{card.next_action}</span>
              {card.next_action_date && (
                <span className="flex-shrink-0 text-[#4b5563]">
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

// Overlay version shown while dragging
export function ApplicationCardOverlay({ card }: { card: KanbanCard }) {
  const accentColor = APPLICATION_STATUS_COLORS[card.status];

  return (
    <div className="relative rounded-lg border border-[#4f8ef7] bg-[#171b26] shadow-xl cursor-grabbing">
      <div
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="px-3 py-2.5 pl-4">
        <p className="text-sm font-medium text-[#e8eaf0] line-clamp-2">
          {card.job?.title ?? "Untitled Position"}
        </p>
        {card.job?.company && (
          <p className="text-xs text-[#6b7280] mt-0.5">{card.job.company}</p>
        )}
      </div>
    </div>
  );
}
