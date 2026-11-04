// 🔴 IRON RULE (AGENTS.md / PRD §6 / 0001_schema.sql):
// Health Score is computed SERVER-SIDE ONLY by the Postgres function
// `compute_health(asset_id)` and cached on `assets.health` / `assets.status`.
// The app MUST read those cached values — NEVER recompute them here.
// This module only holds presentation helpers derived from the cached score.
import type { AssetStatus } from "@/lib/types";

export function healthColor(score: number): string {
  if (score < 40) return "#ef4444"; // red  — Critical
  if (score < 80) return "#f59e0b"; // yellow — Warning
  return "#22c55e"; // green — Healthy
}

// Same thresholds as compute_health() in 0001_schema.sql — the only place
// that should ever turn a health number into a status label.
export function statusFromHealth(score: number): AssetStatus {
  if (score < 40) return "Critical";
  if (score < 80) return "Warning";
  return "Healthy";
}

export function statusBadgeClass(status: AssetStatus): string {
  switch (status) {
    case "Critical":
      return "badge-crit badge-crit-pulse";
    case "Warning":
      return "badge-warn";
    default:
      return "badge-ok";
  }
}

export function statusLabelTh(status: AssetStatus): string {
  switch (status) {
    case "Critical":
      return "วิกฤต";
    case "Warning":
      return "เฝ้าระวัง";
    default:
      return "ปกติ";
  }
}

// Platform "now" parity with the prototype (2026-07-01).
const PLATFORM_NOW = new Date("2026-07-01T00:00:00Z");

export function runHours(installDate: string | null): number {
  const inst = new Date((installDate || "2020-01-01") + "T00:00:00Z");
  if (Number.isNaN(inst.getTime())) return 0;
  const days = Math.max(0, (PLATFORM_NOW.getTime() - inst.getTime()) / 86_400_000);
  return Math.round(days * 24);
}
