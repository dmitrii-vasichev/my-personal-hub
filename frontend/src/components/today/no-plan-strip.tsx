export function NoPlanStrip() {
  return (
    <div className="border-b border-dashed border-[color:var(--line-2)] px-4 py-2 font-mono text-[11px] text-[color:var(--ink-2)]">
      📋 No plan for today. Run{" "}
      <code className="text-[color:var(--accent)]">/planner plan Xh</code> in
      Claude Code to build one.
    </div>
  );
}
