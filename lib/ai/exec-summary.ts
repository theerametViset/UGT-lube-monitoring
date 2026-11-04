import { getProvider } from "./providers";
import type { DashboardData } from "@/lib/queries/assets";
import { statusFromHealth } from "@/lib/scoring/health";

export interface ExecSummaryResult {
  summary: string;
  source: string; // provider name ("glm" | "openai" | "anthropic") or "fallback"
}

// Compact Thai context built from REAL KPIs (RLS-scoped server data).
export function buildExecSummaryContext(data: DashboardData): string {
  const { kpis, perSite, perType, topCritical } = data;
  const lines: string[] = [];
  lines.push(`สินทรัพย์รวม: ${kpis.total} เครื่อง`);
  lines.push(`คะแนนสุขภาพเฉลี่ย: ${kpis.avgHealth}%`);
  lines.push(
    `สถานะ: Critical ${kpis.critical} เครื่อง, Warning ${kpis.warning} เครื่อง, Healthy ${kpis.healthy} เครื่อง`,
  );
  lines.push("");
  lines.push("รายโรงงาน (site):");
  for (const s of perSite) {
    lines.push(
      `- ${s.code}: total ${s.total}, critical ${s.critical}, warning ${s.warning}, healthy ${s.healthy}, avgHealth ${s.avgHealth}%`,
    );
  }
  lines.push("");
  lines.push("ความเสี่ยงแยกตามประเภทเครื่องจักร (เรียงความเสี่ยงมากสุดก่อน):");
  for (const t of perType) {
    lines.push(`- ${t.type}: total ${t.total}, critical ${t.critical}, warning ${t.warning}`);
  }
  lines.push("");
  lines.push(
    `เครื่องจักรวิกฤต 5 อันดับแรก: ${
      topCritical
        .slice(0, 5)
        .map((a) => `${a.id} (${a.name}, health ${a.health}%, site ${a.site})`)
        .join("; ") || "ไม่มี"
    }`,
  );
  return lines.join("\n");
}

export function buildExecSummaryPrompt(ctx: string): string {
  return [
    "คุณคือ Chief Reliability Officer ของโรงงาน เขียนบทสรุปผู้บริหาร (Executive Summary) ความยาว 2–3 ย่อหน้า เป็นภาษาไทย ใช้ตัวเลขจากข้อมูลจริงเท่านั้น ห้ามสมมติตัวเลขที่ไม่อยู่ในข้อมูล",
    "โครงสร้าง: (1) ภาพรวมสุขภาพกองเครื่องจักรพร้อมตัวเลข KPI, (2) จุดเสี่ยงหลัก — ระบุโรงงานหรือประเภทเครื่องจักรที่ต้องเฝ้าระวัง และอ้างชื่อ asset ที่อยู่ในสถานะวิกฤต, (3) ข้อเสนอแนะ 3–4 ข้อเชิงปฏิบัติที่ผู้บริหารสั่งการได้ทันที",
    "เขียนแบบรายงานมืออาชีพ กระชับ อ่านแล้วตัดสินใจได้ทันที ห้ามใช้หัวข้อ markdown (เช่น ## หรือ #) ห้ามใช้สัญลักษณ์ bullet (* หรือ -) ให้เขียนเป็นย่อหน้าธรรมดา",
    "",
    "ข้อมูลจริงของกองเครื่องจักร:",
    ctx,
  ].join("\n");
}

// Fallback — composes a professional summary from real numbers without an LLM.
export function ruleBasedExecSummary(data: DashboardData): string {
  const { kpis, perSite, perType, topCritical } = data;
  const verdict = {
    Healthy: "อยู่ในเกณฑ์ปกติ",
    Warning: "อยู่ในระดับเฝ้าระวัง",
    Critical: "อยู่ในระดับวิกฤตที่ต้องดำเนินการทันที",
  }[statusFromHealth(kpis.avgHealth)];
  const worstSite = [...perSite].filter((s) => s.total > 0).sort((a, b) => a.avgHealth - b.avgHealth)[0];
  const worstType = perType[0];
  const parts: string[] = [];

  parts.push(
    `ภาพรวมกองเครื่องจักรทั้งสิ้น ${kpis.total} เครื่อง มีคะแนนสุขภาพเฉลี่ย ${kpis.avgHealth}% ซึ่ง${verdict} โดยพบเครื่องจักรสถานะวิกฤต ${kpis.critical} เครื่อง และสถานะเฝ้าระวัง ${kpis.warning} เครื่อง ที่ต้องเร่งติดตามและแทรกแซง`,
  );

  if (worstSite) {
    parts.push(
      `จุดเสี่ยงหลักอยู่ที่โรงงาน ${worstSite.code} ซึ่งมีคะแนนสุขภาพเฉลี่ยต่ำสุด ${worstSite.avgHealth}% (วิกฤต ${worstSite.critical} เครื่อง จากทั้งหมด ${worstSite.total} เครื่อง) ควรจัดสรรทรัพยากรตรวจสอบและซ่อมบำรุงเพิ่มเติม`,
    );
  }

  if (worstType) {
    parts.push(
      `ประเภทเครื่องจักรที่มีความเสี่ยงสูงสุดคือ ${worstType.type} (${worstType.critical} เครื่องวิกฤตจากทั้งหมด ${worstType.total} เครื่อง) ควรทบทวนรอบการหล่อลื่นและการเก็บตัวอย่างน้ำมัน`,
    );
  }

  if (topCritical.length > 0) {
    parts.push(
      `เครื่องจักรที่ต้องดำเนินการด่วนที่สุด: ${topCritical
        .slice(0, 5)
        .map((a) => `${a.id} (Health ${a.health}%)`)
        .join(", ")} — แนะนำจัดทำแผนซ่อมบำรุงเชิงรุกภายใน 2 สัปดาห์เพื่อลดความเสี่ยงการหยุดผลิตฉุกเฉิน`,
    );
  }

  parts.push(
    "ข้อเสนอแนะ: (1) เร่งดำเนินการแก้ไขเครื่องจักรวิกฤตทุกรายการภายใน 2 สัปดาห์ (2) รักษารอบการเก็บตัวอย่าง Oil Analysis และ Vibration Survey ตามมาตรฐาน ISO/ASTM (3) ติดตามแนวโน้มค่าการสึกหรอของโรงงานที่มีคะแนนต่ำอย่างใกล้ชิด (4) ทบทวนเกณฑ์แจ้งเตือนให้สอดคล้องกับสภาพการใช้งานจริง",
  );

  return parts.join("\n\n");
}

// Orchestrator: try the configured LLM, fall back to rule-based on any error.
export async function generateExecSummary(data: DashboardData): Promise<ExecSummaryResult> {
  const provider = getProvider();
  if (provider) {
    try {
      const summary = await provider.chat([
        { role: "system", content: buildExecSummaryPrompt(buildExecSummaryContext(data)) },
        { role: "user", content: "กรุณาเขียนบทสรุปผู้บริหารจากข้อมูลข้างต้น" },
      ]);
      const trimmed = summary.trim();
      if (trimmed) return { summary: trimmed, source: provider.name };
    } catch {
      // fall through to rule-based
    }
  }
  return { summary: ruleBasedExecSummary(data), source: "fallback" };
}
