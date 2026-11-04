// DISPLAY-ONLY guidance for the Dashboard's Action Required list: what an
// out-of-limit reading means and what to do next, keyed by alarm_params.key.
// Fixed text (no AI); the engineer makes the final call.
import type { DeductionBreakdown, DeductionItem } from "@/lib/scoring/audit";
import type { OilReading, ScoreConfig, VibReading } from "@/lib/types";
import { suspectVgGrade } from "@/lib/viscosity-limits";

interface ParamAdvice {
  short: string; // headline in front of the action: "น้ำปนเปื้อน"
  meaning: string; // full explanation, on hover
  action: string; // Critical
  warnAction?: string; // Warning; default WARN_OIL / WARN_VIB
}

const WARN_OIL = "ติดตามแนวโน้ม เก็บตัวอย่างซ้ำภายใน 4 สัปดาห์";
const WARN_VIB = "ติดตามแนวโน้ม วัดซ้ำภายใน 4 สัปดาห์";

const ADVICE: Record<string, ParamAdvice> = {
  fe: {
    short: "เฟือง/แบริ่งสึกหรอ",
    meaning: "สึกหรอของชิ้นส่วนเหล็ก (เฟือง / แบริ่ง / เพลา)",
    action: "ตรวจสภาพเฟืองและแบริ่ง เทียบกับผลวัดสั่นสะเทือน พิจารณาเปลี่ยนน้ำมัน",
  },
  water: {
    short: "น้ำปนเปื้อน",
    meaning: "น้ำปนเปื้อน ฟิล์มหล่อลื่นอ่อนลง เสี่ยงสนิมและน้ำมันเสื่อมเร็ว",
    action: "ตรวจการรั่วที่ซีล Breather และ Cooler แล้วไล่น้ำ (Dehydration) หรือเปลี่ยนน้ำมัน",
  },
  visc_high: {
    short: "ความหนืดสูงกว่าเกรด",
    meaning: "ความหนืดสูงกว่าเกรด: น้ำมันออกซิไดซ์ หรือเติมผิดเกรด",
    action: "ตรวจเกรดน้ำมันที่เติม ดู TAN ประกอบ พิจารณาเปลี่ยนน้ำมัน",
  },
  visc_low: {
    short: "ความหนืดต่ำกว่าเกรด",
    meaning: "ความหนืดต่ำกว่าเกรด: น้ำมันเสื่อมจากแรงเฉือน มีตัวทำละลายปน หรือเติมผิดเกรด",
    action: "ตรวจเกรดน้ำมันที่เติมและแหล่งปนเปื้อน พิจารณาเปลี่ยนน้ำมัน",
  },
  tan: {
    short: "น้ำมันเสื่อม กรดสูง",
    meaning: "ค่าความเป็นกรดสูง: น้ำมันออกซิไดซ์ สารเติมแต่ง (Additive) เสื่อมสภาพ เสี่ยงกัดกร่อนชิ้นส่วนโลหะและเกิดตะกอน (Sludge / Varnish)",
    action: "เปลี่ยนน้ำมันและไส้กรอง ตรวจหาสาเหตุความร้อนสูง (Cooler / ภาระเกิน) และการปนเปื้อนของน้ำ",
    warnAction: `${WARN_OIL} ตรวจอุณหภูมิใช้งานและค่าความหนืดประกอบ`,
  },
  iso: {
    short: "อนุภาคปนเปื้อนสูง",
    meaning: "ความสะอาดต่ำกว่าเป้าหมาย มีอนุภาคแข็งปนเปื้อน",
    action: "ตรวจไส้กรองและซีล กรองน้ำมัน (Offline Filtration)",
  },
  vel: {
    short: "สั่นสะเทือนสูง",
    meaning: "สั่นสะเทือนเกินเกณฑ์ ISO 10816-3: Unbalance / Misalignment / Looseness",
    action: "ตรวจ Balance, Alignment และความแน่นของฐานยึด ทำ Spectrum Analysis",
  },
  acc: {
    short: "แรงกระแทกสูง",
    meaning: "แรงกระแทกความถี่สูง: แบริ่งชำรุด หรือหล่อลื่นไม่เพียงพอ",
    action: "ตรวจการหล่อลื่นแบริ่ง วัด Envelope แล้วเตรียมเปลี่ยนแบริ่ง",
  },
  cf: {
    short: "แบริ่งเริ่มเสียหาย",
    meaning: "แรงกระแทกเป็นช่วง ๆ: ความเสียหายของแบริ่งระยะเริ่มต้น",
    action: "เพิ่มความถี่ในการวัด และติดตามแนวโน้ม",
  },
  temp: {
    short: "อุณหภูมิสูง",
    meaning: "อุณหภูมิสูงผิดปกติ: หล่อลื่นไม่เพียงพอ ภาระเกิน หรือระบายความร้อนบกพร่อง",
    action: "ตรวจระดับน้ำมัน / จารบี และระบบระบายความร้อน",
  },
};

export interface ReadingAdvice {
  level: "warn" | "crit";
  label: string; // "Water Content 2,500 ppm"
  badge: string; // "วิกฤต เกิน 2.5 เท่า" — severity and how far over, in one place
  limit: string | null; // "เกณฑ์ 1,000"
  short: string | null; // "น้ำปนเปื้อน"
  meaning: string | null; // full explanation
  action: string;
}

const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

// "เกิน 30%" below 1.5×, "เกิน 2.5 เท่า" from there; "ต่ำกว่า 12%" on the low side.
function overText(value: number, limit: number, side: "high" | "low"): string | null {
  if (!(limit > 0)) return null;
  if (side === "low") return `ต่ำกว่า ${Math.round((1 - value / limit) * 100)}%`;
  const ratio = value / limit;
  return ratio >= 1.5 ? `เกิน ${fmt(Math.round(ratio * 10) / 10)} เท่า` : `เกิน ${Math.round((ratio - 1) * 100)}%`;
}

export function readingAdvice(it: DeductionItem): ReadingAdvice {
  const level = it.level ?? "warn";
  const side = it.side ?? "high";
  const key = it.key === "visc" ? `visc_${side}` : it.key ?? "";
  const advice = ADVICE[key];
  // "TAN (mgKOH/g)" + unit "mgKOH/g" → "TAN"
  const name = it.unit && it.name.endsWith(`(${it.unit})`) ? it.name.slice(0, -it.unit.length - 2).trim() : it.name;
  const over = it.limit != null ? overText(it.value, it.limit, side) : null;
  return {
    level,
    label: `${name} ${fmt(it.value)}${it.unit ? ` ${it.unit}` : ""}`,
    badge: [level === "crit" ? "วิกฤต" : "เฝ้าระวัง", over].filter(Boolean).join(" "),
    limit: it.limit != null && over ? `${side === "low" ? "เกณฑ์ต่ำสุด" : "เกณฑ์"} ${fmt(it.limit)}` : null,
    short: advice?.short ?? null,
    meaning: advice?.meaning ?? null,
    action: level === "crit"
      ? advice?.action ?? "ตรวจสอบสาเหตุและดูรายละเอียดผลตรวจ"
      : advice?.warnAction ?? (it.category === "vib" ? WARN_VIB : WARN_OIL),
  };
}

// Shown once per machine when TAN and water are both out of limits.
export function comboNote(items: DeductionItem[]): string | null {
  const keys = new Set(items.map((it) => it.key));
  return keys.has("tan") && keys.has("water")
    ? "น้ำเร่งการเสื่อมของน้ำมัน (Hydrolysis) ควรแก้ไขแหล่งน้ำรั่วก่อนเปลี่ยนน้ำมัน"
    : null;
}

// Why a machine is losing points: its two biggest deductions with their advice, plus
// notes (suspect VG grade, water + TAN). Shared by the Dashboard's Action Required list
// and the Drill-down's cause band so both say the same thing. A category weighted at 0%
// is skipped when both categories have readings, since it doesn't move the score.
export interface ActionReason { advice: ReadingAdvice[]; notes: string[]; keys: string[] }
export function actionReason(
  b: DeductionBreakdown,
  cfg: ScoreConfig,
  oil: OilReading | null,
  vib: VibReading | null,
  vgGrade: number | null | undefined,
): ActionReason {
  const both = !!oil && !!vib;
  const counts = (c: "oil" | "vib") => !both || (c === "oil" ? cfg.oil_weight : cfg.vib_weight) > 0;
  const items = b.items
    .filter((it) => (it.penalty > 0 || it.cappedFrom != null) && counts(it.category))
    .sort((x, y) => (y.cappedFrom ?? y.penalty) - (x.cappedFrom ?? x.penalty));
  const vg = suspectVgGrade(oil?.visc, vgGrade);
  const notes = [
    vg ? `VG ${vgGrade} ที่ตั้งไว้อาจผิด: ความหนืดที่วัดได้ ${oil?.visc} cSt ใกล้ VG ${vg} — ตรวจข้อมูลเครื่องจักร` : null,
    comboNote(items),
  ].filter((n): n is string => !!n);
  const top = items.slice(0, 2);
  return { advice: top.map(readingAdvice), notes, keys: top.map((it) => it.key ?? "").filter(Boolean) };
}
