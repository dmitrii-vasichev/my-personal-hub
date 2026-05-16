"use client";

import { useMemo } from "react";
import { ActionsTabs } from "@/components/actions/actions-tabs";
import { ActionList } from "@/components/actions/action-list";
import { QuickAddActionForm } from "@/components/actions/quick-add-action-form";
import { isInboxAction } from "@/components/actions/action-filters";
import { useActions } from "@/hooks/use-actions";

export default function ActionsInboxPage() {
  const { data: actions = [], isLoading, error } = useActions();
  const inboxActions = useMemo(
    () => actions.filter(isInboxAction),
    [actions],
  );

  return (
    <div className="flex h-full flex-col gap-2.5 sm:gap-4">
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-2 sm:pb-[14px]">
        <div className="min-w-0">
          <div className="hidden text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono sm:block">
            Module · Actions
          </div>
          <h1 className="font-bold text-[22px] leading-none tracking-[-0.2px] text-[color:var(--ink)] sm:mt-1 sm:text-[28px] sm:leading-[1.1] sm:tracking-[-0.4px]">
            INBOX_
          </h1>
          <p className="mt-1 hidden max-w-[34rem] text-[12px] text-[color:var(--ink-3)] font-mono sm:block">
            {inboxActions.length} unscheduled action{inboxActions.length === 1 ? "" : "s"}
          </p>
        </div>
      </header>

      <ActionsTabs />

      <div className="flex max-w-3xl flex-col gap-2.5 sm:gap-[14px]">
        <QuickAddActionForm />
        <ActionList
          actions={inboxActions}
          isLoading={isLoading}
          error={error}
        />
      </div>
    </div>
  );
}
