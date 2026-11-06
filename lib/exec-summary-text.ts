import type { ActionReason } from "@/lib/scoring/advice";
import type { Asset } from "@/lib/types";
import type { DashboardData } from "@/lib/queries/assets";

// Executive Summary wording, shared by the report preview (client) and the rule-based /
// AI summary (server). Counts first, plain Thai, no "%" on the Health Score.
interface Counts { critical: number; warning: number }
interface SiteCounts { code: string; critical: number; warning: number }

/** Critical machines named in the summary. */
export const EXEC_MAX_CRITICAL = 5;

/**
 * The report narrowed to one plant: counts, machine list, types and summary all speak about
 * that plant only. Filters the stored status — never recomputes health. `perSite` keeps every
 * plant (the comparison table); `siteReliability` holds the scope's own rows.
 */
export function scopeReport(data: DashboardData, site: string): DashboardData {
  if (!site) return data;
  const assets = data.scopedAssets.filter((a) => a.site === site);
  const row = data.perSite.find((s) => s.code === site);
  const count = (list: Asset[]) => ({
    healthy: list.filter((a) => a.status === "Healthy").length,
    warning: list.filter((a) => a.status === "Warning").length,
    critical: list.filter((a) => a.status === "Critical").length,
    total: list.length,
  });
  return {
    ...data,
    kpis: row ? { ...row } : { ...count(assets), avgHealth: 0 },
    siteReliability: data.perSite.filter((s) => s.code === site),
    perType: data.perType
      .map((t) => ({ ...t, ...count(assets.filter((a) => a.type === t.type)) }))
      .filter((t) => t.total > 0)
      .sort((a, b) => b.critical - a.critical || b.warning - a.warning),
    topCritical: assets
      .filter((a) => a.status === "Critical" || a.status === "Warning")
      .sort((a, b) => a.health - b.health)
      .slice(0, 10),
    scopedAssets: assets,
  };
}

/** The machines any report scope can list (worst 10 per plant, as topCritical), so causes load once. */
export function reportActionAssets(assets: Asset[]): Asset[] {
  const act = assets.filter((a) => a.status === "Critical" || a.status === "Warning").sort((a, b) => a.health - b.health);
  const per = new Map<string, number>();
  return act.filter((a) => {
    const n = per.get(a.site) ?? 0;
    per.set(a.site, n + 1);
    return n < 10;
  });
}

const siteList = (codes: string[]) =>
  codes.length <= 2 ? codes.join(" และ ") : `${codes.length} โรงงาน (${codes.join(", ")})`;

/** One line an executive reads first. */
export function execHeadline(k: Counts, perSite: SiteCounts[]): string {
  const where = perSite.filter((s) => s.critical > 0).map((s) => s.code);
  const at = where.length ? `ที่โรงงาน ${siteList(where)}` : "";
  if (k.critical && k.warning) return `มี ${k.critical} เครื่องต้องแก้ไขด่วน${at} และ ${k.warning} เครื่องอยู่ระหว่างเฝ้าระวัง`;
  if (k.critical) return `มี ${k.critical} เครื่องต้องแก้ไขด่วน${at} ไม่มีเครื่องอื่นอยู่ระหว่างเฝ้าระวัง`;
  // one-plant report: say which plant even when nothing is critical
  const plant = perSite.length === 1 ? `โรงงาน ${perSite[0].code}: ` : "";
  if (k.warning) return `${plant}ไม่มีเครื่องที่ต้องแก้ไขด่วน มี ${k.warning} เครื่องอยู่ระหว่างเฝ้าระวัง`;
  return `${plant}ทุกเครื่องอยู่ในเกณฑ์ปกติ ไม่มีเครื่องที่ต้องแก้ไขด่วนหรือเฝ้าระวัง`;
}

/** One critical machine in parts — the report lays them out, criticalLine joins them. */
export function criticalParts(a: Pick<Asset, "id" | "name" | "site" | "health">, r?: ActionReason): { what: string; act: string } {
  const adv = r?.advice ?? [];
  if (!adv.length) return { what: `Health Score ${a.health}`, act: "ตรวจสอบผลแล็บล่าสุดในหน้ารายละเอียดเครื่อง" };
  const what = adv
    .map((x) => {
      const how = x.badge.replace(/^(วิกฤต|เฝ้าระวัง)\s*/, ""); // the headline already says it is critical
      return x.short ? `${x.short} (${x.label} ${how})` : `${x.label} ${how}`;
    })
    .join(" และ");
  return { what, act: adv[0].action.replace(/^ควร/, "") };
}

/** What is wrong with one critical machine and what to do — from the same advice as the Dashboard. */
export function criticalLine(a: Pick<Asset, "id" | "name" | "site" | "health">, r?: ActionReason): string {
  const { what, act } = criticalParts(a, r);
  return `${a.name} (${a.id}, ${a.site}) ${what} ควร${act}`;
}

/** The warning machines in one sentence, counted per plant. */
export function warningLine(k: Counts, perSite: SiteCounts[]): string | null {
  if (!k.warning) return null;
  const by = perSite.filter((s) => s.warning > 0).sort((x, y) => y.warning - x.warning).map((s) => `${s.code} ${s.warning}`);
  // one-plant report: the plant is already in the headline
  return `เครื่องเฝ้าระวัง ${k.warning} เครื่อง${by.length && perSite.length > 1 ? ` (${by.join(", ")})` : ""} ค่าเกินเกณฑ์เล็กน้อย ให้เก็บตัวอย่างซ้ำในรอบถัดไป ยังไม่ต้องหยุดเครื่อง`;
}

/** Overall verdict from the counts — the fleet average hides one critical machine among hundreds. */
export function execVerdict(
  k: Counts,
  perSite: SiteCounts[] = [],
): { label: string; detail: string; tone: "crit" | "warn" | "ok" } {
  if (k.critical) {
    const where = perSite.filter((s) => s.critical > 0).map((s) => s.code);
    return {
      label: "ต้องดำเนินการแก้ไข",
      detail: `พบเครื่องจักรสภาวะวิกฤต ${k.critical} เครื่อง${where.length ? ` (${where.join(", ")})` : ""}`,
      tone: "crit",
    };
  }
  if (k.warning) return { label: "อยู่ในเกณฑ์เฝ้าระวัง", detail: `พบค่าเกินเกณฑ์เล็กน้อย ${k.warning} เครื่อง`, tone: "warn" };
  return { label: "อยู่ในเกณฑ์ปกติ", detail: "ไม่พบค่าเกินเกณฑ์", tone: "ok" };
}

/** "6 พ.ย. 2569" — the plant's date, not the server's (Vercel runs in UTC). */
export function reportDate(now = new Date()): string {
  return now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
}

/** UGT-LUB-<พ.ศ.>-<month>-<plant or ALL>-<type>: the reference printed on the report and in its email. */
export function reportNumber(site: string, type: string, now = new Date()): string {
  const [y, m] = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }).split("-");
  return `UGT-LUB-${Number(y) + 543}-${m}-${site || "ALL"}-${type.toUpperCase()}`;
}

/** User rewording of a report's narrative, keyed by slot (see reportTexts). Numbers are never a slot. */
export type ReportEdits = Record<string, string>;

export interface ReportTexts {
  headline: string;
  critical: { asset: Asset; what: string; act: string }[];
  more: string | null;
  warning: string | null;
  recs: { tag: string; text: string }[];
}

/**
 * Every piece of narrative text in a report, from the plant-scoped data, with any user edits
 * applied. The report, the edit panel and the email all read this, so they say the same thing.
 * Slot keys: headline · what:<id> · act:<id> · warning · rec:<tag>.
 */
export function reportTexts(
  d: DashboardData,
  site: string,
  reasons: Record<string, ActionReason> = {},
  edits: ReportEdits = {},
): ReportTexts {
  const k = d.kpis;
  const sites = d.siteReliability;
  const e = (key: string, text: string) => edits[key]?.trim() || text;
  const crit = d.topCritical.filter((a) => a.status === "Critical").slice(0, EXEC_MAX_CRITICAL);
  const warning = warningLine(k, sites);

  // recommendations follow the summary: what to do with the critical and warning machines
  const recs: { tag: string; text: string }[] = [];
  if (k.critical > 0)
    recs.push({ tag: "Corrective · ≤ 2 สัปดาห์", text: `แก้ไขเครื่องจักรสภาวะวิกฤต ${k.critical} เครื่องตาม Failure Mode ที่ตรวจพบ และ Re-sampling เพื่อยืนยันผล` });
  if (k.warning > 0)
    recs.push({ tag: "Monitoring · รอบถัดไป", text: `Re-sampling เครื่องจักรสภาวะเฝ้าระวัง ${k.warning} เครื่อง ประเมิน Trend หากสูงขึ้นให้วางแผนเปลี่ยนน้ำมัน` });
  const worst = site ? undefined : [...sites].sort((a, b) => b.critical - a.critical || b.warning - a.warning)[0];
  if (worst && worst.critical + worst.warning > 0)
    recs.push({ tag: "Priority", text: `โรงงาน ${worst.code} มีงานค้างมากที่สุด (วิกฤต ${worst.critical}, เฝ้าระวัง ${worst.warning}) ดำเนินการเป็นลำดับแรก` });
  const wType = d.perType.find((t) => t.critical > 0);
  if (wType) recs.push({ tag: "Systemic", text: `ประเภท ${wType.type}: ทบทวนรอบเปลี่ยนน้ำมัน เกรดน้ำมัน และวิธีการหล่อลื่น` });

  return {
    headline: e("headline", execHeadline(k, sites)),
    critical: crit.map((a) => {
      const p = criticalParts(a, reasons[a.id]);
      return { asset: a, what: e(`what:${a.id}`, p.what), act: e(`act:${a.id}`, p.act) };
    }),
    more: k.critical > crit.length ? `และอีก ${k.critical - crit.length} เครื่องวิกฤต ดูรายการทั้งหมดในหน้าภาพรวมความเสี่ยง` : null,
    warning: warning && e("warning", warning),
    recs: recs.map((r) => ({ tag: r.tag, text: e(`rec:${r.tag}`, r.text) })),
  };
}

/** The editable slots of a report, in reading order, for the edit panel and for server-side validation. */
export function reportSlots(t: ReportTexts): { key: string; label: string; text: string }[] {
  return [
    { key: "headline", label: "บทสรุป: ประโยคแรก", text: t.headline },
    ...t.critical.flatMap((c) => [
      { key: `what:${c.asset.id}`, label: `${c.asset.name}: ปัญหาที่พบ`, text: c.what },
      { key: `act:${c.asset.id}`, label: `${c.asset.name}: สิ่งที่ควรทำ`, text: c.act },
    ]),
    ...(t.warning ? [{ key: "warning", label: "เครื่องเฝ้าระวัง", text: t.warning }] : []),
    ...t.recs.map((r) => ({ key: `rec:${r.tag}`, label: `ข้อเสนอแนะ [${r.tag}]`, text: r.text })),
  ];
}

/** Keep only edits for slots this report has, trimmed and capped — the server never trusts the client's keys. */
export function cleanEdits(t: ReportTexts, edits: unknown): ReportEdits {
  if (!edits || typeof edits !== "object") return {};
  const out: ReportEdits = {};
  for (const slot of reportSlots(t)) {
    const v = (edits as Record<string, unknown>)[slot.key];
    if (typeof v === "string" && v.trim()) out[slot.key] = v.trim().slice(0, 1000);
  }
  return out;
}
