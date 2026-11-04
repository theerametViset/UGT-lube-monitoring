"use client";

import { cn } from "@/lib/utils";

// Chart view switch: only the sites / types that have Warning or Critical
// machines (shows where the problems are), or the whole fleet.
export function ProblemsToggle({ problemsOnly, onChange }: { problemsOnly: boolean; onChange: (v: boolean) => void }) {
  const opts: [boolean, string][] = [[true, "เฉพาะที่มีปัญหา"], [false, "ทั้งหมด"]];
  return (
    <div role="group" aria-label="มุมมองกราฟ" className="inline-flex rounded-pill border border-border bg-bg2 p-0.5 text-[13px]">
      {opts.map(([v, label]) => (
        <button
          key={label}
          type="button"
          aria-pressed={problemsOnly === v}
          onClick={() => onChange(v)}
          className={cn("rounded-pill px-2.5 py-0.5 transition", problemsOnly === v ? "bg-cyan/15 font-semibold text-cyan" : "text-t3 hover:text-t1")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// Colour key, in the same place on every chart. "ปกติ" only when the chart shows healthy machines.
export function StatusLegend({ problemsOnly }: { problemsOnly: boolean }) {
  const items: [string, string][] = [["bg-yellow", "เฝ้าระวัง"], ["bg-red", "วิกฤต"]];
  if (!problemsOnly) items.unshift(["bg-green", "ปกติ"]);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-t2">
      {items.map(([dot, label]) => (
        <span key={label} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${dot}`} aria-hidden />{label}
        </span>
      ))}
    </div>
  );
}
