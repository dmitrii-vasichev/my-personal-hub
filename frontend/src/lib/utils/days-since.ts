export function daysSince(
  appliedDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!appliedDate) return null;
  const d = parseLocalDate(appliedDate);
  if (!d) return null;
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.floor((b - d.getTime()) / 86_400_000);
}

// Parse a YYYY-MM-DD string as a local-midnight Date.
// Avoids UTC-parse drift on bare ISO dates.
function parseLocalDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
}
