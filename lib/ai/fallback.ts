// Rule-based fallback DiagnoseResult (no LLM needed). Used when AI_API_KEY is missing
// or the provider call fails. Builds a transparent, data-driven diagnosis.
import type { DiagnoseContext, DiagnoseResult, DiagnoseParam } from "./provider";

export function ruleBasedDiagnose(ctx: DiagnoseContext): DiagnoseResult {
  const o = ctx.oil ?? {};
  const v = ctx.vib ?? {};
  const lim = (cat: string, key: string) =>
    ctx.params.find((p) => p.category === cat && p.key === key) as DiagnoseParam | undefined;

  // find the most abnormal parameter (value above critical, then above warning)
  type Flag = { name: string; cat: "oil" | "vib"; val: number; unit: string; sev: "crit" | "warn" };
  const flags: Flag[] = [];
  for (const cat of ["oil", "vib"] as const) {
    const src = cat === "oil" ? o : v;
    for (const p of ctx.params.filter((x) => x.category === cat)) {
      const val = typeof src[p.key] === "number" ? (src[p.key] as number) : null;
      if (val == null || p.crit_limit == null || p.warn_limit == null) continue;
      if (val > p.crit_limit) flags.push({ name: p.name, cat, val, unit: p.unit ?? "", sev: "crit" });
      else if (val > p.warn_limit) flags.push({ name: p.name, cat, val, unit: p.unit ?? "", sev: "warn" });
    }
  }
  flags.sort((a, b) => (a.sev === "crit" ? -1 : 1) - (b.sev === "crit" ? -1 : 1));
  const top = flags[0];

  const health = ctx.asset.health;
  const primaryAnomaly = top
    ? `${top.name} (${top.val}${top.unit ? " " + top.unit : ""}) ${top.sev === "crit" ? "เกินขีดวิกฤต" : "เกินขีดเตือน"}`
    : "ไม่พบพารามิเตอร์ที่ผิดปกติอย่างชัดเจน";

  const oilFindings = flags.filter((f) => f.cat === "oil").map((f) => `${f.name}: ${f.val}${f.unit ? " " + f.unit : ""} (${f.sev})`);
  const vibFindings = flags.filter((f) => f.cat === "vib").map((f) => `${f.name}: ${f.val}${f.unit ? " " + f.unit : ""} (${f.sev})`);

  const summary =
    `เครื่องจักร ${ctx.asset.name} (${ctx.asset.id}) สถานะ ${ctx.asset.status} คะแนนสุขภาพ ${health}%. ` +
    (top
      ? `ค่าผิดปกติเด่นที่สุดคือ ${primaryAnomaly}. แนะนำตรวจสอบและวางแผนการซ่อมบำรุงตามลำดับความรุนแรง`
      : `ค่าที่วัดอยู่ในเกณฑ์ปกติ แต่คะแนนสุขภาพ ${health}% แนะนำติดตามแนวโน้มอย่างใกล้ชิด`);

  const oilAnalysis = oilFindings.length
    ? `พบค่าผิดปกติ: ${oilFindings.join(", ")}. ควรตรวจสอบการสึกหรอและสภาพน้ำมันหล่อลื่น`
    : "ค่า Oil Analysis อยู่ในเกณฑ์ปกติ";
  const vibrationAnalysis = vibFindings.length
    ? `พบค่าผิดปกติ: ${vibFindings.join(", ")}. ควรตรวจสอบแบริ่ง/การจับ/ความสมดุล (ISO 10816-3)`
    : "ค่า Vibration อยู่ในเกณฑ์ปกติ";

  const rootCause = top
    ? top.cat === "oil"
      ? `น่าจะมาจากการเสื่อมสภาพของน้ำมัน/การปนเปื้อน/การสึกหรอ — เชื่อมโยงกับ ${top.name}`
      : `น่าจะมาจากปัญหาเชิงกล (แบริ่ง/การจับ/ความไม่สมดุล) — เชื่อมโยงกับ ${top.name}`
    : "ยังไม่พบสาเหตุชัดเจน ต้องเก็บข้อมูลเพิ่ม";

  const immediate = top
    ? [`ตรวจสอบและยืนยัน ${top.name} ซ้ำภายใน 24 ชม.`, `บันทึกข้อมูลและแจ้งทีมซ่อมบำรุง`]
    : ["ติดตามแนวโน้มอย่างใกล้ชิด", "เก็บตัวอย่าง/วัดซ้ำในรอบถัดไป"];
  const shortTerm = ["วิเคราะห์แนวโน้มย้อนหลัง 3-6 เดือน", "ตรวจสอบอะไหล่และเตรียมการ"];
  const longTerm = ["ทบทวนรอบการเก็บตัวอย่างและขีดจำกัด (Alarm Config)", "พิจารณา Overhaul ถ้าแนวโน้มเสื่อมต่อเนื่อง"];

  const confidencePct = top ? (top.sev === "crit" ? 82 : 70) : Math.max(55, Math.min(75, 100 - health));

  return {
    summary,
    primaryAnomaly,
    confidencePct,
    oilAnalysis,
    vibrationAnalysis,
    rootCauseHypothesis: rootCause,
    actionPlan: { immediate, shortTerm, longTerm },
  };
}
