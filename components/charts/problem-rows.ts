// Sites / types with any Warning or Critical machine, Critical first, then the
// most machines needing attention — the "problems only" chart view.
export function problemRows<T extends { warning: number; critical: number }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.warning + r.critical > 0)
    .sort((a, b) => b.critical - a.critical || b.warning + b.critical - (a.warning + a.critical));
}
