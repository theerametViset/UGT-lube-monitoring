"use client";

import { useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import type { Chart, ChartOptions } from "chart.js";
import { barEntrance, ensureChartRegistered, stackedBarLook, tokenColor, tooltipLook } from "@/lib/chart";
import { useIsDarkMode } from "@/lib/useIsDarkMode";
import type { TypeAgg } from "@/lib/queries/assets";
import { ProblemsToggle, StatusLegend } from "./ProblemsToggle";
import { problemRows } from "./problem-rows";

ensureChartRegistered();

// Show only the largest types by default so the chart stays readable
// when the fleet contains many equipment types (e.g. 45 in demo data).
const TOP_N = 10;
const ROW_H = 28; // px per bar row (fits the 14px labels)
const CHART_PAD = 16; // extra px for axes


// Draws the fleet total at the right end of each stacked bar so counts stay
// readable without hovering — important when many types are shown.
const barTotalsPlugin = {
  id: "barTotals",
  afterDatasetsDraw(chart: Chart<"bar">) {
    const { ctx } = chart;
    const ds = chart.data.datasets as { data: number[] }[];
    if (!ds.length) return;
    const meta0 = chart.getDatasetMeta(0);
    ctx.save();
    // Plugin runs outside React, so read the theme straight off the DOM.
    ctx.fillStyle = tokenColor("t2");
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";
    for (let i = 0; i < meta0.data.length; i++) {
      const total = ds.reduce((sum, d) => sum + (d.data[i] ?? 0), 0);
      const y = meta0.data[i]?.y;
      const x = chart.scales.x.getPixelForValue(total);
      if (y === undefined || Number.isNaN(x)) continue;
      ctx.fillText(String(total), x + 5, y);
    }
    ctx.restore();
  },
};

export function RiskConcentrationChart({ data }: { data: TypeAgg[] }) {
  const dark = useIsDarkMode();
  void dark; // re-render on theme change so tokenColor() reads the new palette
  const tick = tokenColor("t2");
  const tickMuted = tokenColor("t2");
  const grid = tokenColor("border", 0.35);
  const look = stackedBarLook(true);
  const [showAll, setShowAll] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(true);

  // Problems-only: types with Warning/Critical machines, Critical first.
  // Whole fleet: ordered by fleet size (most -> least machines).
  const sorted: TypeAgg[] = useMemo(
    () => (problemsOnly ? problemRows(data) : [...data].sort((a, b) => b.total - a.total)),
    [data, problemsOnly],
  );
  const expandable = sorted.length > TOP_N;

  const rows: (TypeAgg | AggRow)[] = useMemo(() => {
    if (!expandable || showAll) return sorted;
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);
    const agg = rest.reduce(
      (acc, d) => ({
        healthy: acc.healthy + d.healthy,
        warning: acc.warning + d.warning,
        critical: acc.critical + d.critical,
        total: acc.total + d.total,
      }),
      { healthy: 0, warning: 0, critical: 0, total: 0 },
    );
    return [
      ...top,
      {
        type: `อื่นๆ (${rest.length} ประเภท)`,
        abbr: "",
        color: "#94a3b8",
        ...agg,
      },
    ];
  }, [sorted, expandable, showAll]);

  const ds0 = rows;

  const labels = rows.map((d) => (d.abbr ? `${d.abbr} ${d.type}` : d.type));

  const chartData = {
    labels,
    datasets: [
      {
        label: "วิกฤต",
        data: rows.map((d) => d.critical),
        backgroundColor: tokenColor("red", 0.8),
        hoverBackgroundColor: tokenColor("red"),
        stack: "s",
        ...look,
      },
      {
        label: "เฝ้าระวัง",
        data: rows.map((d) => d.warning),
        backgroundColor: tokenColor("yellow", 0.75),
        hoverBackgroundColor: tokenColor("yellow"),
        stack: "s",
        ...look,
      },
      {
        label: "ปกติ",
        // problems-only: the healthy machines would dwarf the few that need attention
        data: rows.map((d) => (problemsOnly ? 0 : d.healthy)),
        backgroundColor: tokenColor("green", 0.55),
        hoverBackgroundColor: tokenColor("green", 0.8),
        stack: "s",
        ...look,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    animation: barEntrance(),
    // Right padding keeps the bar-total labels inside the canvas
    layout: { padding: { right: 40 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipLook(),
        callbacks: {
          label(ctx) {
            return ` ${ctx.dataset.label}: ${ctx.parsed.x} เครื่อง`;
          },
          footer(items) {
            const idx = items[0]?.dataIndex ?? -1;
            if (idx < 0) return "";
            return `ทั้งหมด ${ds0[idx].total} เครื่อง`;
          },
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: grid },
        border: { display: false },
        ticks: { color: tick, font: { size: 14 }, precision: 0 },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: {
          color: tickMuted,
          font: { size: 14 },
          autoSkip: false,
          // Long type names shrink to fit without pushing the plot away
          callback(value) {
            const raw = this.getLabelForValue(Number(value));
            return raw.length > 22 ? `${raw.slice(0, 21)}…` : raw;
          },
        },
      },
    },
  };


  const chartHeight = rows.length * ROW_H + CHART_PAD;
  const scrollable = showAll && expandable;

  const chart = (
    <div style={{ height: chartHeight }} className="relative">
      <Bar data={chartData as never} options={options} plugins={[barTotalsPlugin]} />
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ProblemsToggle problemsOnly={problemsOnly} onChange={setProblemsOnly} />
        <StatusLegend problemsOnly={problemsOnly} />
        {expandable && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-pill border border-cyan/30 bg-cyan/5 px-2 py-0.5 text-[14px] font-semibold text-cyan transition hover:bg-cyan/10"
          >
            {showAll ? `ย่อเหลือ Top ${TOP_N}` : `แสดงทั้งหมด (${sorted.length} ประเภท)`}
          </button>
        )}
        <span className="text-[13px] text-t3">{problemsOnly ? "เรียงตามจำนวนเครื่องที่มีปัญหา" : "เรียงตามจำนวนเครื่องจักร"}</span>
      </div>
      {data.length === 0 || sorted.length === 0 ? (
        <div className="flex h-[230px] items-center justify-center text-[14px] text-t3">
          {data.length === 0 ? "ไม่มีข้อมูลในขอบเขตที่เลือก" : "ทุกประเภทอยู่ในเกณฑ์ปกติ"}
        </div>
      ) : scrollable ? (
        <div className="mt-1 max-h-[340px] overflow-y-auto pr-1">{chart}</div>
      ) : (
        <div className="mt-1">{chart}</div>
      )}
    </div>
  );
}

interface AggRow {
  type: string;
  abbr: string;
  color: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}
