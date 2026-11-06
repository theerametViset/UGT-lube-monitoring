import type { DashboardData } from "@/lib/queries/assets";
import type { ActionReason } from "@/lib/scoring/advice";
import { reportTexts, type ReportEdits } from "@/lib/exec-summary-text";

// The report's executive summary as plain text (the emailed report): headline, each critical
// machine with its cause, the warning machines. `data` is already scoped to the report's plant.
export function ruleBasedExecSummary(
  data: DashboardData,
  reasons: Record<string, ActionReason> = {},
  edits: ReportEdits = {},
  site = "",
): string {
  const t = reportTexts(data, site, reasons, edits);
  return [
    t.headline,
    ...t.critical.map((c) => `${c.asset.name} (${c.asset.id}, ${c.asset.site}) ${c.what} ควร${c.act.replace(/^ควร/, "")}`),
    t.more,
    t.warning,
  ]
    .filter(Boolean)
    .join("\n\n");
}
