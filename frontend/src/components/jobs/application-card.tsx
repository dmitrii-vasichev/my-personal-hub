"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import type { KanbanCard } from "@/types/job";
import { daysSince } from "@/lib/utils/days-since";
import { formatAppliedDate } from "@/lib/utils/format-applied-date";

interface ApplicationCardProps {
  card: KanbanCard;
  isDragging?: boolean;
}

const HOT_STATUSES = new Set<string>([
  "screening",
  "technical_interview",
  "final_interview",
]);

const TERMINAL_STATUSES_SET = new Set<string>([
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
]);

function isHotCard(card: KanbanCard): boolean {
  if (!card.next_action_date) return false;
  if (!HOT_STATUSES.has(card.status)) return false;
  const d = daysSince(card.next_action_date);
  if (d === null) return false;
  // next_action_date 0..3 days away in the future → daysSince returns -3..0
  return d >= -3 && d <= 0;
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

  const hot = isHotCard(card);
  const isOffer = card.status === "offer";
  const isTerminal = TERMINAL_STATUSES_SET.has(card.status);

  // Border + background variant (compose via clsx-like string join)
  const variantBorder = hot
    ? "border-[color:var(--accent-2)]"
    : isOffer
      ? "border-[color:var(--accent-3)]"
      : "border-[color:var(--line)] hover:border-[color:var(--line-2)]";

  const handleClick = (e: React.MouseEvent) => {
    if (transform) return;
    e.stopPropagation();
    router.push(`/jobs/${card.id}`);
  };

  const appliedDaysSince = daysSince(card.applied_date);
  const appliedLabel = formatAppliedDate(card.applied_date);
  const hasFooterA = Boolean(card.applied_date) || appliedLabel === "—";
  // Line B (location + score): omit if both missing
  const hasLocation = Boolean(card.location);
  const hasScore = card.match_score != null;
  const hasFooterB = hasLocation || hasScore;

  const appliedFooterText =
    card.applied_date && appliedDaysSince !== null
      ? `${appliedLabel} · ${appliedDaysSince}D`
      : "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      data-testid={`application-card-${card.id}`}
      className={`
        group relative border-[1.5px] bg-[color:var(--bg-2)] cursor-pointer transition-colors
        ${variantBorder}
        ${isDragging ? "opacity-50 cursor-grabbing" : ""}
        ${isTerminal ? "opacity-60" : ""}
      `}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[color:var(--ink-3)] active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="px-3 py-2.5 pr-7 flex flex-col gap-1">
        {/* Line 1: company name */}
        <p
          className={`text-[13px] font-bold leading-snug line-clamp-1 ${
            isTerminal
              ? "text-[color:var(--ink-3)]"
              : "text-[color:var(--ink)]"
          }`}
        >
          {card.company || "—"}
        </p>

        {/* Line 2: role title */}
        <p className="text-[12px] text-[color:var(--ink-2)] line-clamp-2">
          {card.title ?? "Untitled Position"}
        </p>

        {/* Line 3 (footer A): applied date + days-since */}
        {hasFooterA && (
          <p className="mt-1 text-[10.5px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            {appliedFooterText}
          </p>
        )}

        {/* Line 4 (footer B, optional): location + match_score */}
        {hasFooterB && (
          <p className="text-[10.5px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
            {hasLocation && <span>{card.location}</span>}
            {hasLocation && hasScore && <span> · </span>}
            {hasScore && <span>SCORE {card.match_score}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

export function ApplicationCardOverlay({ card }: { card: KanbanCard }) {
  return (
    <div className="border-[1.5px] border-[color:var(--accent)] bg-[color:var(--bg-2)] shadow-xl cursor-grabbing">
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-bold text-[color:var(--ink)] line-clamp-1">
          {card.company || "—"}
        </p>
        <p className="text-[12px] text-[color:var(--ink-2)] mt-0.5 line-clamp-2">
          {card.title ?? "Untitled Position"}
        </p>
      </div>
    </div>
  );
}
