import type { ReactNode } from "react";
import type { DeductionItem } from "@/lib/scoring/audit";

// One category (oil or vib) of a health-score deduction breakdown — shared by
// the Drill-down Health tab and the Alarm Config live audit preview so both
// stay in exact parity. Shows the category's own clamped sub-score, never a
// re-summed total, so it can't visually contradict the items listed above it.
export function DeductionSection({
  title,
  weight,
  score,
  items,
  emptyLabel,
}: {
  title: ReactNode;
  weight: number;
  score: number;
  items: DeductionItem[];
  emptyLabel: string;
}) {
  return (
    <div className="border-b border-border py-2">
      <div className="mb-1 flex items-center justify-between text-[13px] font-bold text-t3">
        <span className="inline-flex items-center gap-1.5">{title} (Weight {weight}%)</span>
        <span className="font-mono text-t1">{score}/100</span>
      </div>
      {items.length ? (
        items.map((it, i) => (
          <div key={i} className="flex items-center justify-between border-b border-dashed border-black/5 py-1">
            <div>
              <div className="text-[14px] font-semibold text-red">{it.name}</div>
              <div className="text-[13px] text-t3">{it.reason}</div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-red">−{it.penalty}</div>
              {it.cappedFrom != null && (
                <div className="text-[13px] text-t3">เกณฑ์ −{it.cappedFrom} · คะแนนหมวดถึง 0 แล้ว</div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="py-1 text-[13px] italic text-t3">{emptyLabel}</div>
      )}
    </div>
  );
}
