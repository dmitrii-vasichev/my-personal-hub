"use client";

import { useEffect, useRef, useState } from "react";
import {
  useFocusSessionActive,
  useStopFocusMutation,
} from "@/hooks/use-focus-session";

function formatCountdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function NowBlock() {
  const { data: session } = useFocusSessionActive();
  const stop = useStopFocusMutation();

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasFiredAutoStopRef = useRef(false);

  // Reset single-fire guard whenever the active session changes (new session
  // started after a prior stop).
  useEffect(() => {
    hasFiredAutoStopRef.current = false;
  }, [session?.id]);

  const plannedMs = (session?.planned_minutes ?? 0) * 60_000;
  const startedMs = session ? new Date(session.started_at).getTime() : 0;
  const elapsedMs = session ? now - startedMs : 0;
  const remainingSec = session ? Math.floor((plannedMs - elapsedMs) / 1000) : 0;
  const totalSec = session ? session.planned_minutes * 60 : 0;

  useEffect(() => {
    if (!session) return;
    if (
      remainingSec <= 0 &&
      !hasFiredAutoStopRef.current &&
      !stop.isPending
    ) {
      hasFiredAutoStopRef.current = true;
      stop.mutate(session.id);
    }
  }, [remainingSec, session, stop]);

  if (!session) return null;

  const label = session.action_title ?? session.plan_item_title ?? "FOCUS";

  return (
    <div className="grid grid-cols-[64px_14px_1fr_auto] gap-[14px] items-center p-[10px_16px] bg-[color:var(--bg-2)] border-l-[3px] border-l-[color:var(--accent)]">
      <div className="text-[color:var(--accent)] font-mono text-xs tracking-[1px]">
        NOW
      </div>
      <div
        className="size-2 bg-[color:var(--accent)] animate-pulse"
        aria-hidden
      />
      <div className="min-w-0 truncate font-mono text-sm text-[color:var(--ink)]">
        ▶ {label}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-[color:var(--ink-2)] font-mono text-xs tabular-nums">
          {formatCountdown(remainingSec)} / {formatCountdown(totalSec)}
        </div>
        <button
          type="button"
          onClick={() => stop.mutate(session.id)}
          disabled={stop.isPending}
          className="font-mono text-xs uppercase tracking-[1px] border border-[color:var(--line)] px-2 py-1 text-[color:var(--ink-3)] hover:text-[color:var(--danger)] hover:border-[color:var(--danger)] transition-colors disabled:opacity-50"
        >
          STOP
        </button>
      </div>
    </div>
  );
}
