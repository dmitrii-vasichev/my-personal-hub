export function TodaySkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-16 border-y border-[color:var(--line)] bg-[color:var(--bg-2)]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-40 border border-[color:var(--line)]" />
        <div className="h-40 border border-[color:var(--line)]" />
      </div>
      <div className="h-64 border border-[color:var(--line)]" />
    </div>
  );
}
