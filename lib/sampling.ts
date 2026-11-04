// Oil sampling / oil change due dates, in "YYYY-MM" months, shown on the
// Drill-down page: due = base month + interval, overdue when that month has
// passed, "soon" when it's this month or next.

export type DueStatus = "overdue" | "soon" | "ok";

export const DUE_META: Record<DueStatus, { color: string; label: string }> = {
  overdue: { color: "#ef4444", label: "เลยกำหนด" },
  soon: { color: "#f59e0b", label: "ใกล้ครบกำหนด" },
  ok: { color: "#22c55e", label: "ปกติ" },
};

export function nowYM(): string {
  // The plant's month, not UTC's (the server runs in UTC: 06:30 on the 1st was still last month).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).slice(0, 7);
}

export function addMonthsYM(ym: string, months: number): string {
  const [y, m] = (ym || nowYM()).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Whole months from this month to dueYM (negative = already past).
export function monthsUntil(dueYM: string): number {
  const now = new Date();
  const [y, m] = dueYM.split("-").map(Number);
  return (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth());
}

export function dueStatus(dueYM: string): DueStatus {
  const diff = monthsUntil(dueYM);
  if (diff < 0) return "overdue";
  if (diff <= 1) return "soon";
  return "ok";
}

export function dueInfo(dueYM: string): { color: string; label: string } {
  return DUE_META[dueStatus(dueYM)];
}

// Next oil sample: counted from the latest oil reading, falling back to the
// asset's last_update when it has never been sampled in the system.
export function nextSampleYM(latestOilPeriod: string | null, lastUpdate: string | null, intervalMonths: number): string {
  return addMonthsYM(latestOilPeriod ?? lastUpdate ?? nowYM(), intervalMonths);
}
