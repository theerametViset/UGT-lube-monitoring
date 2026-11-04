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
export function tokenColor(name: string, alpha = 1): string {
  const rgb = typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim();
  const [r, g, b] = (rgb || "128 128 128").split(/\s+/);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
