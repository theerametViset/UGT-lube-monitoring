"use client";

import { Bar } from "react-chartjs-2";
import { FlaskConical } from "lucide-react";
import type { ChartOptions } from "chart.js";
import { ensureChartRegistered } from "@/lib/chart";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import type { RcaProbabilities } from "@/lib/scoring/rca";

ensureChartRegistered();

const MODES: { key: keyof RcaProbabilities; label: string }[] = [
  { key: "bearingFatigue", label: "Bearing Fatigue" },
  { key: "lubeFailure", label: "Lube Failure" },
  { key: "misalignment", label: "Misalignment" },
  { key: "imbalance", label: "Imbalance" },
  { key: "sealWear", label: "Seal Wear" },
  { key: "contamination", label: "Contamination" },
];

export function RcaChart({ p }: { p: RcaProbabilities }) {
  const dark = useIsDarkMode();
  const tick = dark ? "#C7C7CF" : "#475569";
  const grid = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.035)";
  const values = MODES.map((m) => p[m.key]);
  const anyData = values.some((v) => v != null);
  const missing = MODES.filter((_, i) => values[i] == null).map((m) => m.label);

  // No readings at all — show an honest empty state instead of a chart of
  // invented (default-based) risk scores.
  if (!anyData) {
    return (
      <div className="flex h-[180px] flex-col items-center justify-center rounded border border-dashed border-border bg-bg3/60 text-center">
        <FlaskConical className="h-7 w-7 text-t3 opacity-50" aria-hidden />
        <div className="mt-1 text-[14px] font-semibold text-t2">ไม่มีข้อมูล Oil / Vibration Analysis</div>
        <div className="mt-0.5 max-w-[240px] text-[13px] leading-relaxed text-t3">
          เก็บตัวอย่างน้ำมัน / วัดความสั่นสะเทือนก่อน เพื่อดู Failure Mode Risk
        </div>
      </div>
    );
  }

  const data = {
    labels: MODES.map((m) => m.label),
    datasets: [
      {
        // null values are skipped by Chart.js — the "ไม่มีข้อมูล" note below
        // explains which modes could not be scored.
        label: "Risk Index",
        data: values as (number | null)[],
        backgroundColor: "rgba(0,102,204,.55)",
        borderRadius: 3,
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { max: 100, grid: { color: grid }, ticks: { color: tick, font: { size: 13 }, callback: (v) => `${v}%` } },
      y: { grid: { display: false }, ticks: { color: tick, font: { size: 13 } } },
    },
  };
  return (
    <div>
      <div className="relative h-[180px]">
        <Bar data={data as never} options={options} />
      </div>
      {missing.length > 0 && (
        <div className="mt-1.5 text-[13px] leading-relaxed text-t3">
          — ไม่มีข้อมูลสำหรับ: {missing.join(", ")}
        </div>
      )}
    </div>
  );
}
