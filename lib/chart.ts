// Centralized Chart.js registration (shared by all chart components).
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

let registered = false;

export function ensureChartRegistered(): void {
  if (registered) return;
  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Filler,
    Tooltip,
    Legend,
  );
  registered = true;
}

// Chart.js paints on a canvas, so Tailwind classes can't reach it: read the theme's
// own colour tokens (app/globals.css, "R G B") so charts follow light / dark and any
// palette change. Called during render; charts re-render on theme change.
// `from`: read the token where the chart sits (the report's white paper keeps light colours in dark mode).
export function tokenColor(name: string, alpha = 1, from?: Element | null): string {
  const rgb = typeof window === "undefined" ? "" : getComputedStyle(from ?? document.documentElement).getPropertyValue(`--c-${name}`).trim();
  const [r, g, b] = (rgb || "128 128 128").split(/\s+/);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Stacked status bars (Dashboard site + type charts): one look for both.
type BarCtx = import("chart.js").ScriptableContext<"bar">;
// The last visible, non-zero segment of a bar's stack: the one that gets the rounded end.
function stackTop(c: BarCtx): number {
  const ds = c.chart.data.datasets;
  for (let i = ds.length - 1; i >= 0; i--) if (c.chart.isDatasetVisible(i) && Number(ds[i].data[c.dataIndex]) > 0) return i;
  return -1;
}
export function stackedBarLook(horizontal = false, from?: Element | null) {
  const end = horizontal ? { topRight: 6, bottomRight: 6 } : { topLeft: 6, topRight: 6 };
  // A segment only a few px tall (2 warnings among 200 healthy) would vanish under the gap line.
  const tall = (c: BarCtx) => {
    const s = c.chart.scales[horizontal ? "x" : "y"];
    return Math.abs(s.getPixelForValue(Number(c.raw)) - s.getPixelForValue(0)) > 6;
  };
  return {
    borderRadius: (c: BarCtx) => (c.datasetIndex === stackTop(c) ? end : 0),
    // a 2px surface-coloured gap between stacked segments
    borderWidth: (c: BarCtx) => (c.datasetIndex === stackTop(c) || !tall(c) ? 0 : horizontal ? { right: 2 } : { top: 2 }),
    borderColor: tokenColor("bg2", 1, from),
    borderSkipped: false as const,
  };
}
// Bars rise one after another on first draw; none for print or reduced motion.
export function barEntrance(off = false) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (off || reduce) return false as const;
  return {
    duration: 700,
    easing: "easeOutQuart" as const,
    delay: (c: { type: string; mode: string; dataIndex: number }) => (c.type === "data" && c.mode === "default" ? c.dataIndex * 70 : 0),
  };
}
// Tooltip in the app's surface colours instead of Chart.js's default black box.
export function tooltipLook(from?: Element | null) {
  return {
    backgroundColor: tokenColor("bg3", 0.97),
    titleColor: tokenColor("t1"),
    bodyColor: tokenColor("t2"),
    footerColor: tokenColor("t3"),
    borderColor: tokenColor("border"),
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    boxPadding: 4,
    usePointStyle: true,
  };
}
