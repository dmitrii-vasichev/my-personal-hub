"use client";

import type { ReachChannel } from "@/types/lead";
import { REACH_CHANNEL_CONFIG } from "@/types/lead";

interface ChannelChipsProps {
  counts: Record<ReachChannel, number>;
  enabled: Record<ReachChannel, boolean>;
  onToggle: (channel: ReachChannel) => void;
}

const CHANNELS: ReachChannel[] = ["email", "website", "phone_only"];

export function ChannelChips({ counts, enabled, onToggle }: ChannelChipsProps) {
  const total = counts.email + counts.website + counts.phone_only;
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {CHANNELS.map((ch) => {
        const cfg = REACH_CHANNEL_CONFIG[ch];
        const active = enabled[ch];
        const count = counts[ch];

        return (
          <button
            key={ch}
            onClick={() => onToggle(ch)}
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
              border transition-all select-none
              ${active
                ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                : "border-transparent bg-transparent text-[var(--text-tertiary)] opacity-50"
              }
            `}
          >
            <span
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: cfg.color }}
            />
            {cfg.label}
            <span className="text-[var(--text-tertiary)] tabular-nums">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ChannelBadge({ channel }: { channel: ReachChannel }) {
  const cfg = REACH_CHANNEL_CONFIG[channel];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-transparent"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
