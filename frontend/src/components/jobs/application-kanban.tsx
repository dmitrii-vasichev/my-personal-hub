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
import { useJobKanban } from "@/hooks/use-jobs";
import { ApplicationColumn } from "./application-column";
import { ApplicationCardOverlay } from "./application-card";
import { StatusChangeDialog } from "./status-change-dialog";

interface PendingChange {
  cardId: number;
  oldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
}

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div
          key={colIdx}
          className="flex w-[240px] shrink-0 flex-col gap-2 rounded-lg bg-card border border-border-subtle p-3 animate-pulse"
        >
          <div className="h-3.5 w-24 rounded bg-surface-hover mb-2" />
          {Array.from({ length: colIdx === 0 ? 3 : colIdx === 1 ? 2 : 2 }).map((_, cardIdx) => (
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

export function ApplicationKanban() {
  const { data: kanbanData, isLoading, error } = useJobKanban();
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);

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
      setPendingChange({ cardId, oldStatus, newStatus });
    }
  };

  const handleDialogCancel = () => {
    setPendingChange(null);
  };

  if (isLoading) {
    return <KanbanSkeleton />;
  }

  if (error || !kanbanData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-destructive">Failed to load pipeline</p>
      </div>
    );
  }

  const allColumns = [...PIPELINE_COLUMNS, ...TERMINAL_STATUSES];
  const isEmpty = !isLoading && allColumns.every((col) => (kanbanData[col] ?? []).length === 0);

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border-subtle">
          <GitBranch className="h-5 w-5 text-tertiary" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">No tracked jobs yet</p>
          <p className="mt-1 text-xs text-tertiary">
            Start tracking jobs from the Jobs tab
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_COLUMNS.map((status) => (
            <ApplicationColumn
              key={status}
              status={status}
              cards={kanbanData[status] ?? []}
              activeCardId={activeCard?.id ?? null}
            />
          ))}
        </div>

        <div className="mt-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-tertiary px-1">
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

      {pendingChange && (
        <StatusChangeDialog
          open={true}
          onOpenChange={(open) => {
            if (!open) handleDialogCancel();
          }}
          jobId={pendingChange.cardId}
          currentStatus={pendingChange.oldStatus}
          preselectedStatus={pendingChange.newStatus}
          onSuccess={() => setPendingChange(null)}
          onCancel={handleDialogCancel}
        />
      )}
    </>
  );
}
