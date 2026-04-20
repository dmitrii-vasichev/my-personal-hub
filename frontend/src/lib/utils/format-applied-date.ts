export function formatAppliedDate(
  appliedDate: string | null | undefined,
): string {
  if (!appliedDate) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(appliedDate);
  if (!m) return "—";
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (isNaN(date.getTime())) return "—";
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toUpperCase();
  return `${date.getDate()} ${month}`;
}
