// AI interpretation of the RCA Failure Mode Risk Index (per-asset).
// Builds a structured context from the real risk indices + latest readings,
// asks the configured LLM to explain the top failure modes, and falls back to
// a transparent rule-based analysis when no AI key is available.
import { getProvider } from "./providers";
import type { RcaProbabilities } from "@/lib/scoring/rca";
import type { AlarmParam, Asset, OilReading, VibReading } from "@/lib/types";

export interface RcaAnalysisResult {
  analysis: string;
  source: string; // provider name or "fallback"
}

const MODE_LABELS: Record<keyof RcaProbabilities, string> = {
  bearingFatigue: "Bearing Fatigue (แบริ่งล้า)",
  lubeFailure: "Lube Failure (น้ำมันเสื่อมสภาพ)",
  misalignment: "Misalignment (เพลาไม่อยู่ศูนย์)",
  imbalance: "Imbalance (ไม่สมดุล)",
  sealWear: "Seal Wear (ซีลสึก)",
  contamination: "Contamination (สิ่งปนเปื้อน)",
};

const MODE_FACTORS: Record<
  keyof RcaProbabilities,
  { key: string; label: string; cat: "oil" | "vib"; crit: number; weight: number }[]
> = {
  bearingFatigue: [
    { key: "fe", label: "Fe", cat: "oil", crit: 200, weight: 55 },
    { key: "acc", label: "Peak Accel", cat: "vib", crit: 10, weight: 25 },
  ],
  lubeFailure: [
    { key: "water", label: "Water", cat: "oil", crit: 1000, weight: 50 },
    { key: "tan", label: "TAN", cat: "oil", crit: 1.0, weight: 30 },
  ],
  misalignment: [{ key: "vel", label: "Vel RMS", cat: "vib", crit: 7.1, weight: 60 }],
  imbalance: [
    { key: "vel", label: "Vel RMS", cat: "vib", crit: 7.1, weight: 40 },
    { key: "acc", label: "Peak Accel", cat: "vib", crit: 10, weight: 10 },
  ],
  sealWear: [
    { key: "water", label: "Water", cat: "oil", crit: 1000, weight: 45 },
    { key: "fe", label: "Fe", cat: "oil", crit: 200, weight: 20 },
  ],
  contamination: [
    { key: "water", label: "Water", cat: "oil", crit: 1000, weight: 80 },
  ],
};

export interface RcaContext {
  asset: { id: string; name: string; type: string; site: string; health: number; status: string };
  rca: RcaProbabilities;
  oil: Record<string, number | string | null> | null;
  vib: Record<string, number | string | null> | null;
  params: AlarmParam[];
}

// Real crit limits override the defaults above when configured.
function critOf(cat: "oil" | "vib", key: string, fallback: number, params: AlarmParam[]): number {
  return params.find((p) => p.category === cat && p.key === key)?.crit_limit ?? fallback;
}

export function buildRcaContext(
  asset: Asset,
  rca: RcaProbabilities,
  oil: OilReading | null,
  vib: VibReading | null,
  params: AlarmParam[],
): RcaContext {
  return {
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      site: asset.site,
      health: asset.health,
      status: asset.status,
    },
    rca,
    oil: (oil as unknown as Record<string, number | string | null> | null) ?? null,
    vib: (vib as unknown as Record<string, number | string | null> | null) ?? null,
    params,
  };
}

export function buildRcaSystemPrompt(ctx: RcaContext): string {
  const idx = (Object.keys(MODE_LABELS) as (keyof RcaProbabilities)[])
    .map((k) => `${MODE_LABELS[k]}: ${ctx.rca[k] ?? "ไม่มีข้อมูล"}`)
    .join("\n- ");
  const oil = ctx.oil ?? {};
  const vib = ctx.vib ?? {};
  const readings = [
    `Oil: Fe ${oil.fe ?? "N/A"} ppm | Water ${oil.water ?? "N/A"} ppm | TAN ${oil.tan ?? "N/A"}`,
    `Vib: Vel RMS ${vib.vel ?? "N/A"} mm/s | Peak Accel ${vib.acc ?? "N/A"} g-PK`,
  ].join("\n");
  return [
    "คุณคือ Reliability Engineer อาวุโส วิเคราะห์ผล RCA Failure Mode Risk Index ของเครื่องจักรเครื่องเดียว",
    `เครื่อง: ${ctx.asset.name} (${ctx.asset.id}) | ${ctx.asset.type} | โรงงาน ${ctx.asset.site} | Health ${ctx.asset.health}% | สถานะ ${ctx.asset.status}`,
    "RCA Risk Index (0-100, null = ยังไม่มีข้อมูล):",
    idx,
    "ค่าที่วัดล่าสุด:",
    readings,
    "กฎการตอบ:",
    "- ตอบเป็นภาษาไทย ใช้ตัวเลขจากข้อมูลจริงเท่านั้น ห้ามสมมติตัวเลข",
    "- ระบุ failure mode ที่มีความเสี่ยงสูงสุด 2-3 อันดับ อธิบายว่าค่าไหนที่ขับเคลื่อนให้สูง และควรตรวจสอบอะไร",
    "- ถ้า Risk Index ทั้งหมดเป็น null ให้ตอบว่ายังไม่มีข้อมูลเพียงพอ ควรเก็บตัวอย่างก่อน",
    "- จบด้วยข้อเสนอแนะเชิงปฏิบัติ 3-4 ข้อ (ตรวจสอบ/วัดซ้ำ/บำรุงรักษา)",
    "- เขียนเป็นย่อหน้าธรรมดา กระชับ ห้ามใช้หัวข้อ markdown หรือสัญลักษณ์ bullet",
  ].join("\n");
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function numOf(o: Record<string, number | string | null> | null, key: string): number | null {
  const v = o?.[key];
  return typeof v === "number" ? v : null;
}

// Fallback — transparent, data-driven analysis without an LLM.
export function ruleBasedRcaAnalysis(ctx: RcaContext): string {
  const modes = (Object.keys(MODE_LABELS) as (keyof RcaProbabilities)[])
    .map((k) => ({ key: k, value: ctx.rca[k] }))
    .filter((m): m is { key: keyof RcaProbabilities; value: number } => m.value != null)
    .sort((a, b) => b.value - a.value);

  const lines: string[] = [];
  lines.push(`📊 ${ctx.asset.name} (${ctx.asset.id}) — สถานะ ${ctx.asset.status}, Health ${ctx.asset.health}%`);

  if (modes.length === 0) {
    lines.push(
      "ยังไม่มีข้อมูล Oil / Vibration Analysis เพียงพอสำหรับการวิเคราะห์ RCA — กรุณาเก็บตัวอย่างน้ำมันและวัดความสั่นสะเทือนก่อน",
    );
    return lines.join("\n");
  }

  const top = modes[0];
  const topN = modes.slice(0, 3);

  lines.push("");
  lines.push(`🎯 ความเสี่ยงสูงสุด: ${MODE_LABELS[top.key]} (${top.value}/100)`);
  lines.push("");
  lines.push("เหตุผลจากค่าที่วัดได้:");
  for (const m of topN) {
    const factors = MODE_FACTORS[m.key]
      .map((f) => {
        const src = f.cat === "oil" ? ctx.oil : ctx.vib;
        const val = numOf(src, f.key);
        if (val == null) return null;
        const crit = critOf(f.cat, f.key, f.crit, ctx.params);
        const pct = crit > 0 ? Math.round((val / crit) * 100) : 0;
        return `${f.label} ${fmtNum(val)} (${pct}% ของวิกฤต ${fmtNum(crit)})`;
      })
      .filter((x): x is string => x != null);
    lines.push(`- ${MODE_LABELS[m.key]} (${m.value}): ${factors.join(" + ") || "—"}`);
  }

  lines.push("");
  const sev =
    top.value >= 70
      ? "ความเสี่ยงสูง — ควรตรวจสอบเชิงลึกและวางแผนแก้ไขโดยเร็ว"
      : top.value >= 45
        ? "ความเสี่ยงปานกลาง — ควรเฝ้าระวังและติดตามแนวโน้ม"
        : "ความเสี่ยงต่ำ — ติดตามตามรอบปกติ";
  lines.push(`💡 สรุป: ${sev}`);

  const mech = ["bearingFatigue", "misalignment", "imbalance"].some((k) => modes.some((m) => m.key === k && m.value >= 45));
  const lube = ["lubeFailure", "sealWear", "contamination"].some((k) => modes.some((m) => m.key === k && m.value >= 45));
  const actions: string[] = [];
  if (mech) actions.push("ตรวจสอบแบริ่ง การยึดจับ และความสมดุลเพลา (ISO 10816-3) พร้อมวัดซ้ำยืนยัน");
  if (lube) actions.push("ตรวจสภาพน้ำมัน (Fe/Water/TAN) พิจารณาเปลี่ยนถ่าย/กรองน้ำมัน และตรวจซีล");
  actions.push(`ทบทวนแนวโน้ม 3-6 เดือนของ ${topN.map((m) => MODE_LABELS[m.key]).join(", ")}`);
  actions.push("แจ้งทีมซ่อมบำรุงและวางแผนงานตามลำดับความรุนแรง");
  lines.push(`🛠 ข้อเสนอแนะ:\n${actions.map((a, i) => `${i + 1}. ${a}`).join("\n")}`);

  return lines.join("\n");
}

// Orchestrator: LLM first, rule-based fallback on any error.
export async function generateRcaAnalysis(ctx: RcaContext): Promise<RcaAnalysisResult> {
  const provider = getProvider();
  if (provider) {
    try {
      const analysis = await provider.chat([
        { role: "system", content: buildRcaSystemPrompt(ctx) },
        { role: "user", content: "กรุณาวิเคราะห์ RCA Failure Mode Risk Index ของเครื่องนี้" },
      ]);
      const trimmed = analysis.trim();
      if (trimmed) return { analysis: trimmed, source: provider.name };
    } catch {
      // fall through to rule-based
    }
  }
  return { analysis: ruleBasedRcaAnalysis(ctx), source: "fallback" };
}

