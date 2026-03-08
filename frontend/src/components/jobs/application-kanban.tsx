"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ApplicationStatus, KanbanCard } from "@/types/job";
import { PIPELINE_COLUMNS, TERMINAL_STATUSES } from "@/types/job";
import { useApplicationKanban, useChangeApplicationStatus } from "@/hooks/use-applications";
import { ApplicationColumn } from "./application-column";
import { ApplicationCardOverlay } from "./application-card";

export function ApplicationKanban() {
  const { data: kanbanData, isLoading, error } = useApplicationKanban();
  const changeStatus = useChangeApplicationStatus();
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { data } = event.active;
    if (data.current?.card) {
      setActiveCard(data.current.card as KanbanCard);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const newStatus = over.id as ApplicationStatus;
    const cardId = active.id as number;
    const oldStatus = (active.data.current?.status as ApplicationStatus) ?? null;

    if (newStatus !== oldStatus) {
      changeStatus.mutate({ id: cardId, data: { new_status: newStatus } });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[#5C5C66]">Loading pipeline...</p>
      </div>
    );
  }

  if (error || !kanbanData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[#E5484D]">Failed to load pipeline</p>
      </div>
    );
  }

  const allColumns = [...PIPELINE_COLUMNS, ...TERMINAL_STATUSES];
  const isEmpty = !isLoading && allColumns.every((col) => (kanbanData[col] ?? []).length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#131316] border border-[#232329]">
          <GitBranch className="h-5 w-5 text-[#5C5C66]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#8B8B93]">No applications yet</p>
          <p className="mt-1 text-xs text-[#5C5C66]">
            Start tracking jobs from the Jobs tab
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
      {/* Main pipeline board */}
      <div
        className={`flex gap-4 overflow-x-auto pb-4 transition-opacity ${
          changeStatus.isPending ? "opacity-70" : ""
        }`}
      >
        {PIPELINE_COLUMNS.map((status) => (
          <ApplicationColumn
            key={status}
            status={status}
            cards={kanbanData[status] ?? []}
            activeCardId={activeCard?.id ?? null}
          />
        ))}
      </div>

      {/* Terminal statuses section */}
      <div className="mt-6">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#5C5C66] px-1">
          Completed
        </p>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TERMINAL_STATUSES.map((status) => (
            <ApplicationColumn
              key={status}
              status={status}
              cards={kanbanData[status] ?? []}
              activeCardId={activeCard?.id ?? null}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeCard ? <ApplicationCardOverlay card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
