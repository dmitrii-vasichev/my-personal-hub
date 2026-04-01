"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { LeadKanbanCard, LeadStatus, ReachChannel } from "@/types/lead";
import { LEAD_PIPELINE_COLUMNS, LEAD_TERMINAL_STATUSES, getReachChannel } from "@/types/lead";
import { useLeadKanban, useChangeLeadStatus } from "@/hooks/use-leads";
import { OutreachColumn } from "./outreach-column";
import { OutreachCardOverlay } from "./outreach-card";

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 4 }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="flex w-[240px] shrink-0 flex-col gap-2 rounded-lg bg-card border border-border-subtle p-3 animate-pulse"
        >
          <div className="h-3.5 w-24 rounded bg-surface-hover mb-2" />
          {Array.from({ length: colIdx === 0 ? 3 : 2 }).map((_, cardIdx) => (
            <div
              key={cardIdx}
              className="rounded-md bg-surface border border-border-subtle p-3"
            >
              <div className="h-3.5 bg-surface-hover rounded w-4/5 mb-2" />
              <div className="h-3 bg-surface-hover rounded w-3/5" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

interface OutreachKanbanProps {
  channelEnabled?: Record<ReachChannel, boolean>;
  onCardClick?: (cardId: number) => void;
}

export function OutreachKanban({ channelEnabled, onCardClick }: OutreachKanbanProps = {}) {
  const { data: kanbanData, isLoading, error } = useLeadKanban();
  const changeStatus = useChangeLeadStatus();
  const [activeCard, setActiveCard] = useState<LeadKanbanCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    if (data.current?.card) {
      setActiveCard(data.current.card as LeadKanbanCard);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const newStatus = over.id as LeadStatus;
    const cardId = active.id as number;
    const oldStatus = (active.data.current?.status as LeadStatus) ?? null;

    if (newStatus !== oldStatus) {
      changeStatus.mutate({ id: cardId, data: { new_status: newStatus } });
    }
  };

  const filteredKanban = useMemo(() => {
    if (!kanbanData) return null;
    if (!channelEnabled) return kanbanData;
    const allOn = channelEnabled.email && channelEnabled.website && channelEnabled.phone_only;
    if (allOn) return kanbanData;
    const result = {} as typeof kanbanData;
    for (const key of Object.keys(kanbanData) as Array<keyof typeof kanbanData>) {
      result[key] = kanbanData[key].filter((card) => channelEnabled[getReachChannel(card)]);
    }
    return result;
  }, [kanbanData, channelEnabled]);

  if (isLoading) return <KanbanSkeleton />;

  if (error || !filteredKanban) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-destructive">Failed to load pipeline</p>
      </div>
    );
  }

  const allColumns = [...LEAD_PIPELINE_COLUMNS, ...LEAD_TERMINAL_STATUSES];
  const isEmpty = allColumns.every((col) => (filteredKanban[col] ?? []).length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border-subtle">
          <Users className="h-5 w-5 text-tertiary" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">No leads yet</p>
          <p className="mt-1 text-xs text-tertiary">
            Add leads to start tracking your outreach pipeline
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_PIPELINE_COLUMNS.map((status) => (
          <OutreachColumn
            key={status}
            status={status}
            cards={filteredKanban[status] ?? []}
            activeCardId={activeCard?.id ?? null}
            onCardClick={onCardClick}
          />
        ))}
      </div>

      {LEAD_TERMINAL_STATUSES.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-tertiary px-1">
            Closed
          </p>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {LEAD_TERMINAL_STATUSES.map((status) => (
              <OutreachColumn
                key={status}
                status={status}
                cards={filteredKanban[status] ?? []}
                activeCardId={activeCard?.id ?? null}
              />
            ))}
          </div>
        </div>
      )}

      <DragOverlay>
        {activeCard ? <OutreachCardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
