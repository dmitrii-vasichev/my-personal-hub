"use client";

import { Command } from "cmdk";
import * as RadixDialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useCommandPalette } from "@/hooks/use-command-palette";
import { useRouteHistory } from "@/hooks/use-route-history";
import { useRecentEntities } from "@/hooks/use-recent-entities";
import { getVisibleNavSections } from "@/components/layout/sidebar";
import { useAuth } from "@/lib/auth";
import { useVitalsConnection } from "@/hooks/use-vitals";

const ENTITY_GLYPH: Record<"job", string> = {
  job: "▤",
};

interface QuickAction {
  id: string;
  label: string;
  glyph: string;
  href: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: "new-action", label: "New action…", glyph: "+", href: "/actions?new=1" },
];

const ROW_CLASS =
  "px-[18px] py-[8px] flex items-center gap-[12px] text-[13px] cursor-pointer " +
  "data-[selected=true]:bg-[color:var(--accent)] data-[selected=true]:text-[#0e0e0c]";
const GLYPH_CLASS =
  "w-[22px] text-center text-[color:var(--ink-3)] text-[12px] " +
  "group-data-[selected=true]:text-[#0e0e0c]";
const HEADING_CLASS =
  "[&_[cmdk-group-heading]]:px-[18px] [&_[cmdk-group-heading]]:pt-[10px] " +
  "[&_[cmdk-group-heading]]:pb-[4px] [&_[cmdk-group-heading]]:text-[9.5px] " +
  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[2px] " +
  "[&_[cmdk-group-heading]]:text-[color:var(--ink-3)]";

export function CommandPalette() {
  const { open, setOpen, query, setQuery } = useCommandPalette();
  const router = useRouter();
  const history = useRouteHistory();
  const entities = useRecentEntities().filter((entity) => entity.kind === "job");
  const { isDemo } = useAuth();
  const { data: vitalsConnection } = useVitalsConnection();

  const run = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const jumpItems = useMemo(
    () =>
      getVisibleNavSections({
        isDemo,
        vitalsConnected: vitalsConnection?.connected ?? false,
      }).flatMap((s) => s.items),
    [isDemo, vitalsConnection?.connected]
  );
  const routeMeta = useMemo(
    () =>
      Object.fromEntries(
        jumpItems.map((i) => [i.href, { label: i.label, glyph: i.glyph }])
      ),
    [jumpItems]
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command Menu"
      loop
      overlayClassName="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100]"
      contentClassName="fixed left-1/2 top-[100px] -translate-x-1/2 w-[620px] max-w-[94vw] bg-[color:var(--bg)] border-2 border-[color:var(--accent)] shadow-[0_0_40px_rgba(217,255,61,0.15)] z-[101]"
    >
      <RadixDialog.Title className="sr-only">Command Menu</RadixDialog.Title>
      <RadixDialog.Description className="sr-only">
        Jump to a page or run a quick action. Press Escape to close.
      </RadixDialog.Description>
      <div className="flex items-center gap-[10px] px-[18px] py-[16px] border-b-[1.5px] border-[color:var(--line)]">
        <span className="text-[color:var(--accent)]">▸</span>
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="search or type a command…"
          className="flex-1 bg-transparent outline-none border-none font-[family-name:var(--font-jetbrains-mono)] text-base text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)]"
        />
        <span className="text-[10px] text-[color:var(--ink-3)]">ESC</span>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto py-[4px]">
        <Command.Empty className="py-[20px] text-center text-[color:var(--ink-3)] text-[13px]">
          No results
        </Command.Empty>

        <Command.Group heading="QUICK ACTIONS" className={HEADING_CLASS}>
          {QUICK_ACTIONS.map((a) => (
            <Command.Item
              key={a.id}
              value={a.label}
              onSelect={() => run(a.href)}
              className={`group ${ROW_CLASS}`}
            >
              <span className={GLYPH_CLASS} aria-hidden>{a.glyph}</span>
              <span>{a.label}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="JUMP TO" className={HEADING_CLASS}>
          {jumpItems.map((r) => (
            <Command.Item
              key={r.href}
              value={`${r.label} ${r.href}`}
              onSelect={() => run(r.href)}
              className={`group ${ROW_CLASS}`}
            >
              <span className={GLYPH_CLASS} aria-hidden>{r.glyph}</span>
              <span>{r.label}</span>
            </Command.Item>
          ))}
        </Command.Group>

        {(entities.length > 0 || history.length > 0) && (
          <Command.Group heading="RECENT" className={HEADING_CLASS}>
            {entities.map((e) => (
              <Command.Item
                key={`recent-entity-${e.href}`}
                value={`recent ${e.label} ${e.href}`}
                onSelect={() => run(e.href)}
                className={`group ${ROW_CLASS}`}
              >
                <span className={GLYPH_CLASS} aria-hidden>{ENTITY_GLYPH.job}</span>
                <span className="truncate">{e.label}</span>
              </Command.Item>
            ))}
            {history.map((path) => {
              const meta = routeMeta[path];
              if (!meta) return null;
              return (
                <Command.Item
                  key={`recent-${path}`}
                  value={`recent ${meta.label} ${path}`}
                  onSelect={() => run(path)}
                  className={`group ${ROW_CLASS}`}
                >
                  <span className={GLYPH_CLASS} aria-hidden>{meta.glyph}</span>
                  <span>{meta.label}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
