"use client";

import { Line } from "react-chartjs-2";
import type { ChartOptions, Plugin } from "chart.js";
import { ensureChartRegistered } from "@/lib/chart";
import { useIsDarkMode } from "@/lib/useIsDarkMode";

ensureChartRegistered();

export interface TrendSeries {
  label: string;
  data: (number | null)[];
  color: string;
  yAxis?: "y" | "y1";
  warn?: number | null;
  crit?: number | null;
}

/** Round a raw axis step up to 1/2/2.5/5 × 10^n so ticks read cleanly (0.5, 2.5, 25 …). */
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Plugin that draws horizontal threshold lines directly on the canvas */
const thresholdPlugin: Plugin = {
  id: "thresholdLines",
  afterDraw(chart) {
    const opts = (chart.options.plugins as any)?.thresholdLines;
    if (!opts?.lines?.length) return;
    const { ctx } = chart;
    for (const line of opts.lines) {
      const yScale = chart.scales[line.yAxisID ?? "y"];
      if (!yScale) continue;
      const yPixel = yScale.getPixelForValue(line.value);
      const { top, bottom } = chart.chartArea;
      if (yPixel < top - 5 || yPixel > bottom + 5) continue;
      ctx.save();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = 2;
      ctx.setLineDash(line.dash);
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, yPixel);
      ctx.lineTo(chart.chartArea.right, yPixel);
      ctx.stroke();
      ctx.font = "bold 11px sans-serif";
      ctx.textBaseline = "middle";
      if (opts.outside) {
        // In the reserved right margin: never sits on top of a data point.
        ctx.fillStyle = line.color;
        ctx.textAlign = "left";
        ctx.fillText(line.label, chart.chartArea.right + 4, yPixel);
      } else {
        // Backed label so it stays readable when a data point sits on the threshold.
        ctx.textAlign = "right";
        const w = ctx.measureText(line.label).width;
        const x = chart.chartArea.right - 4;
        ctx.fillStyle = opts.labelBg ?? "rgba(255,255,255,.85)";
        ctx.fillRect(x - w - 3, yPixel - 15, w + 6, 13);
        ctx.fillStyle = line.color;
        ctx.fillText(line.label, x, yPixel - 8);
      }
      ctx.restore();
    }
  },
};

export function TrendLineChart({
  labels,
  series,
  height = 195,
}: {
  labels: string[];
  series: TrendSeries[];
  height?: number;
}) {
  const dark = useIsDarkMode();
  const tick = dark ? "#C7C7CF" : "#475569";
  const grid = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.035)";
  const datasets: any[] = [];
  const thresholdLines: any[] = [];

  for (const s of series) {
    datasets.push({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.color + "14",
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: s.data.length === 1 ? 8 : 4,
      pointBackgroundColor: s.color,
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      pointHoverRadius: 8,
      yAxisID: s.yAxis ?? "y",
    });

    if (s.warn != null) {
      thresholdLines.push({
        value: s.warn,
        color: "#f59e0b",
        dash: [6, 4],
        label: `${s.warn}`,
        yAxisID: s.yAxis ?? "y",
      });
    }
    if (s.crit != null) {
      thresholdLines.push({
        value: s.crit,
        color: "#ef4444",
        dash: [10, 5],
        label: `🔴 ${s.crit}`,
        yAxisID: s.yAxis ?? "y",
      });
    }
  }

  const data = { labels, datasets };
  // ~7px per character of the longest "1000" style label, plus the 4px gap.
  const labelRoom = Math.max(0, ...thresholdLines.map((l) => String(l.label).length * 7 + 8));
  const hasSecond = series.some((s) => s.yAxis === "y1");

  const yScaleConfig = (() => {
    const allVals: number[] = [];
    for (const s of series) {
      for (const v of s.data) { if (v != null) allVals.push(v); }
      if (s.warn != null) allVals.push(s.warn);
      if (s.crit != null) allVals.push(s.crit);
    }
    if (allVals.length === 0) return { grid: { color: grid }, ticks: { color: tick, font: { size: 13 } } };
    const min = Math.min(...allVals);
    const max = Math.max(...allVals);
    // Scale to the data, not to multiples of 10 — otherwise small-range values like TAN (0.2–2)
    // get a fixed 0–10 axis and flatten against the bottom.
    const pad = (max - min) * 0.15 || Math.abs(max) * 0.2 || 1;
    const step = niceStep((max - min + 2 * pad) / 5);
    return {
      min: Math.max(0, Math.floor((min - pad) / step) * step),
      max: Math.ceil((max + pad) / step) * step,
      grid: { color: grid },
      ticks: { color: tick, font: { size: 13 }, stepSize: step },
    };
  })();

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: false },
    // Right margin for the threshold labels (unless a second axis already uses that side).
    layout: { padding: { right: hasSecond || thresholdLines.length === 0 ? 0 : labelRoom } },
    plugins: {
      legend: {
        display: true,
        labels: { font: { size: 13 }, color: tick },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}`,
        },
      },
      // @ts-ignore - custom plugin option
      thresholdLines: { lines: thresholdLines, outside: !hasSecond, labelBg: dark ? "rgba(20,20,24,.85)" : "rgba(255,255,255,.85)" },
    },
    scales: {
      x: { offset: true, grid: { display: false }, ticks: { color: tick, font: { size: 13 } } },
      y: yScaleConfig,
      ...(hasSecond
        ? { y1: { position: "right", grid: { display: false }, ticks: { color: tick, font: { size: 13 } } } }
        : {}),
    },
  };
  return (
    <div style={{ height }} className="relative">
      <Line data={data as never} options={options} plugins={[thresholdPlugin]} />
    </div>
  );
}
