"use client";

import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { ensureChartRegistered } from "@/lib/chart";
import { useIsDarkMode } from "@/lib/useIsDarkMode";

ensureChartRegistered();

export function VibrationHistoryChart({
  labels,
  vel,
  acc,
}: {
  labels: string[];
  vel: (number | null)[];
  acc: (number | null)[];
}) {
  const dark = useIsDarkMode();
  const tick = dark ? "#C7C7CF" : "#475569";
  const grid = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.035)";
  const data = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "Velocity RMS",
        data: vel,
        backgroundColor: "rgba(0,102,204,.52)",
        borderRadius: 2,
      },
      {
        type: "line" as const,
        label: "Peak Accel",
        data: acc,
        borderColor: "#f472b6",
        backgroundColor: "rgba(244,114,182,.08)",
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        yAxisID: "y1",
      },
    ],
  };
  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, labels: { font: { size: 13 }, color: tick } } },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, font: { size: 13 } } },
      y: { grid: { color: grid }, ticks: { color: tick, font: { size: 13 } } },
      y1: { position: "right", grid: { display: false }, ticks: { color: tick, font: { size: 13 } } },
    },
  };
  return (
    <div className="relative h-[195px]">
      <Bar data={data as never} options={options} />
    </div>
  );
}
