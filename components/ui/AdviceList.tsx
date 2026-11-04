import { TriangleAlert } from "lucide-react";
import type { ActionReason } from "@/lib/scoring/advice";

// The out-of-limit readings of one machine, each with its limit and next step, then the
// notes. Same markup on the Dashboard's Action Required list and the Drill-down cause band.
export function AdviceList({ reason }: { reason: Pick<ActionReason, "advice" | "notes"> }) {
  return (
    <div className="space-y-1.5 text-[14px] text-t1">
      {reason.advice.length ? reason.advice.map((r) => (
        <div key={r.label}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{r.label}</span>
            <span className={`rounded px-1.5 text-[13px] font-semibold ${r.level === "crit" ? "bg-red/15 text-red" : "bg-yellow/15 text-yellow"}`}>{r.badge}</span>
            {r.limit && <span className="text-[13px] text-t3">{r.limit}</span>}
          </div>
          <div className="text-t2" title={r.meaning ?? undefined}>
            {r.short && <span className="text-t1">{r.short}: </span>}
            {r.action}
          </div>
        </div>
      )) : <span className="text-t3">ไม่มีผลตรวจที่เกินเกณฑ์</span>}
      {reason.notes.map((n) => (
        <div key={n} className="flex items-start gap-1.5 text-[13px] text-t3">
          <TriangleAlert className="mt-1 h-3 w-3 shrink-0 text-yellow" aria-hidden />{n}
        </div>
      ))}
    </div>
  );
}
