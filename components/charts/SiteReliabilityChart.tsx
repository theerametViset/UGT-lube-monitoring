"use client";

import { useState } from "react";
import { Bar } from "react-chartjs-2";
import { ImageDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ChartOptions, Plugin } from "chart.js";
import { ensureChartRegistered, tokenColor } from "@/lib/chart";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import type { SiteAgg } from "@/lib/queries/assets";
import { ProblemsToggle, StatusLegend } from "./ProblemsToggle";
import { problemRows } from "./problem-rows";

ensureChartRegistered();

/**
 * Writes the Warning / Critical counts above each site's stack. With hundreds of healthy
 * machines those segments are only a pixel or two tall, so the bar alone hides them.
 */
const problemCountsPlugin: Plugin<"bar"> = {
  id: "problemCounts",
  afterDatasetsDraw(chart) {
    const opts = (chart.options.plugins as any)?.problemCounts;
    if (!opts) return;
    const { ctx } = chart;
    const warn = chart.data.datasets[1]?.data as number[];
    const crit = chart.data.datasets[2]?.data as number[];
    const top = chart.getDatasetMeta(2).data; // Critical is the top of the stack
    ctx.save();
    ctx.font = "bold 14px sans-serif";
    ctx.textBaseline = "middle";
    top.forEach((bar, i) => {
      const parts = [
        { n: warn?.[i] ?? 0, color: opts.warnColor },
        { n: crit?.[i] ?? 0, color: opts.critColor },
      ].filter((p) => p.n > 0);
      if (!parts.length) return;
      const dot = 9, gap = 4, between = 10;
      const widths = parts.map((p) => dot + gap + ctx.measureText(String(p.n)).width);
      const total = widths.reduce((a, b) => a + b, 0) + between * (parts.length - 1);
      let x = bar.x - total / 2;
      const y = bar.y - 13;
      parts.forEach((p, k) => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x + dot / 2, y, dot / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = "left";
        ctx.fillText(String(p.n), x + dot + gap, y);
        x += widths[k] + between;
      });
    });
    ctx.restore();
  },
};

export function SiteReliabilityChart({
  data: allSites,
  noAnimation = false,
  className,
  siteHrefs,
  modeToggle = false,
}: {
  data: SiteAgg[];
  noAnimation?: boolean;
  className?: string;
  /** site code → link; when given, clicking a bar opens that site (Dashboard only, not the printed report). */
  siteHrefs?: Record<string, string>;
  /** Dashboard: switch between only the sites with problems (default) and every site. */
  modeToggle?: boolean;
}) {
  const router = useRouter();
  const dark = useIsDarkMode();
  const [problemsOnly, setProblemsOnly] = useState(modeToggle);
  const data = problemsOnly ? problemRows(allSites) : allSites;
  void dark; // re-render on theme change so tokenColor() reads the new palette
  const tick = tokenColor("t2");
  const grid = tokenColor("border", 0.7);
  const labels = data.map((d) => [d.code, `${d.avgHealth}`]);

  const chartData = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "ปกติ",
        // problems-only: the healthy machines would dwarf the few that need attention
        data: data.map((d) => (problemsOnly ? 0 : d.healthy)),
        backgroundColor: tokenColor("green", 0.85),
        stack: "s",
      },
      {
        type: "bar" as const,
        label: "เฝ้าระวัง",
        data: data.map((d) => d.warning),
        backgroundColor: tokenColor("yellow", 0.85),
        stack: "s",
      },
      {
        type: "bar" as const,
        label: "วิกฤต",
        data: data.map((d) => d.critical),
        backgroundColor: tokenColor("red", 0.9),
        stack: "s",
      },
    ],
  };

  const stackMax = Math.max(1, ...data.map((d) => (problemsOnly ? d.warning + d.critical : d.total)));
  // Round step so the top tick is a clean number.
  const step = [1, 2, 5, 10, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => stackMax / s <= 6) ?? 10000;

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: noAnimation ? false : undefined,
    // Room above the bars for the Warning/Critical counts.
    layout: { padding: { top: 24 } },
    // whole column is the hit area, so thin bars (e.g. UTCA) are as easy to click as tall ones
    interaction: { mode: "index", intersect: false },
    onClick: siteHrefs
      ? (_e, els) => {
          const d = els[0] ? data[els[0].index] : undefined;
          const href = d ? siteHrefs[d.code] : undefined;
          if (href) router.push(href);
        }
      : undefined,
    onHover: siteHrefs
      ? (e, els) => {
          const t = e.native?.target as HTMLElement | undefined;
          if (t) t.style.cursor = els.length ? "pointer" : "default";
        }
      : undefined,
    plugins: {
      legend: { display: false },
      // @ts-expect-error custom plugin option
      problemCounts: { warnColor: tokenColor("yellow"), critColor: tokenColor("red") },
      tooltip: {
        mode: "index" as const,
        callbacks: {
          title: (items) => (items[0] ? data[items[0].dataIndex]?.code ?? "" : ""),
          footer: (items) => {
            const d = items[0] ? data[items[0].dataIndex] : undefined;
            return d ? [`คะแนนสุขภาพเฉลี่ย ${d.avgHealth}`, ...(siteHrefs ? ["คลิกเพื่อกรองโรงงานนี้"] : [])] : "";
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        // two-line label: site code + its average health score (the cached assets.health average)
        ticks: { color: tick, font: { size: 14, weight: "bold" as const } },
      },
      y: {
        stacked: true,
        // grace leaves room above the tallest stack for the Warning/Critical counts
        grace: "12%",
        grid: { color: grid },
        ticks: { color: tick, font: { size: 14 }, stepSize: step },
      },
    },
  };
  return (
    // min-h keeps the chart usable when stacked on mobile; the absolute inner box lets the
    // canvas follow a flex-grown parent without Chart.js's resize feedback loop.
    <div id="site-reliability-chart" className={`flex min-h-[300px] flex-col ${className ?? ""}`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {modeToggle && <ProblemsToggle problemsOnly={problemsOnly} onChange={setProblemsOnly} />}
          <StatusLegend problemsOnly={problemsOnly} />
        </div>
      <button
        aria-label="ดาวน์โหลดกราฟ"
        onClick={() => {
          const canvas = document.querySelector("#site-reliability-chart canvas") as HTMLCanvasElement | null;
          if (canvas) {
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/png");
            a.download = "site_reliability.png";
            a.click();
          }
        }}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg2 px-1.5 py-0.5 text-[13px] text-t3 hover:border-cyan hover:text-cyan"
      >
        <ImageDown className="h-3.5 w-3.5" aria-hidden /> PNG
      </button>
      </div>
      <div className="relative min-h-[240px] flex-1">
        <div className="absolute inset-0">
          {data.length > 0 ? (
            <Bar data={chartData as never} options={options} plugins={[problemCountsPlugin]} />
          ) : (
            <div className="flex h-full items-center justify-center text-[14px] text-t3">ทุกโรงงานอยู่ในเกณฑ์ปกติ</div>
          )}
        </div>
      </div>
    </div>
  );
}
