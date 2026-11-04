// AI summary / Q&A for a single engineering standard (from the Standards Library).
// Sends title + description + full_text to the configured LLM; falls back to a
// transparent extraction-based answer when no AI key is available.
import { getProvider } from "./providers";
import type { Standard } from "@/lib/types";

export interface StandardAiResult {
  analysis: string;
  source: string; // provider name or "fallback"
}

export function buildStandardContext(std: Standard): string {
  return [
    `มาตรฐาน: ${std.title}`,
    `หมวดหมู่: ${std.category}`,
    `ชื่อย่อ: ${std.subtitle ?? "-"}`,
    `คำอธิบาย: ${std.description ?? "-"}`,
    `เนื้อหา: ${std.full_text ?? "-"}`,
    `Tags: ${(std.tags ?? []).join(", ") || "-"}`,
  ].join("\n");
}

export function buildStandardSummaryPrompt(ctx: string): string {
  return [
    "คุณคือวิศวกรความน่าเชื่อถือ ให้สรุปมาตรฐานวิศวกรรมฉบับนี้เป็นภาษาไทย กระชับ 2-3 ย่อหน้า",
    "โครงสร้าง: (1) มาตรฐานนี้คืออะไรและใช้กับอะไร, (2) เกณฑ์/ตัวเลขสำคัญ (ยกจากเนื้อหาจริงเท่านั้น), (3) ข้อควรปฏิบัติ",
    "ห้ามสมมติเนื้อหาที่ไม่อยู่ในข้อมูล ห้ามใช้หัวข้อ markdown หรือ bullet",
    "",
    ctx,
  ].join("\n");
}

export function buildStandardQaPrompt(ctx: string, question: string): string {
  return [
    "คุณคือวิศวกรความน่าเชื่อถือ ตอบคำถามต่อไปนี้โดยอ้างอิงจากเนื้อหามาตรฐานเท่านั้น ตอบเป็นภาษาไทย กระชับ",
    "ถ้าคำถามอยู่นอกเหนือเนื้อหามาตรฐาน ให้ตอบตรงๆ ว่ามาตรฐานนี้ไม่ได้ระบุเรื่องนั้น",
    "ห้ามสมมติตัวเลข/เกณฑ์ที่ไม่อยู่ในเนื้อหา",
    "",
    ctx,
    "",
    `คำถาม: ${question}`,
  ].join("\n");
}

// Fallback — extract the description + first few sentences of the full text.
export function ruleBasedStandardSummary(std: Standard): string {
  const parts: string[] = [];
  if (std.description) parts.push(`📘 คำอธิบาย: ${std.description}`);
  const full = std.full_text ?? "";
  const sentences = full
    .split(/\n+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(\||##)/.test(s)); // table rows and section titles don't read as a summary
  if (sentences.length) {
    parts.push(`📋 สาระสำคัญ:\n- ${sentences.slice(0, 4).join("\n- ")}`);
  }
  if ((std.tags ?? []).length) parts.push(`🏷 Tags: ${(std.tags ?? []).join(", ")}`);
  parts.push(`💡 อ่านเพิ่ม: ${std.subtitle ?? "เปิดเนื้อหาฉบับเต็มในคลังมาตรฐาน"}`);
  return parts.join("\n\n");
}

// Fallback Q&A — answer from the sentences that contain question keywords.
export function ruleBasedStandardAnswer(std: Standard, question: string): string {
  const ql = question.trim().toLowerCase();
  if (!ql) return ruleBasedStandardSummary(std);

  const tokens = ql
    .split(/[\s,;:]+/)
    .map((t) => t.replace(/[^\p{L}\p{N}%]/gu, ""))
    .filter((t) => t.length >= 2);
  const full = std.full_text ?? "";
  const sentences = full
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hits = sentences.filter((s) => {
    const sl = s.toLowerCase();
    return tokens.some((t) => sl.includes(t));
  });

  if (hits.length) {
    return `🔎 พบในเนื้อหามาตรฐาน ${std.title}:\n${hits
      .slice(0, 3)
      .map((s) => `- ${s}`)
      .join("\n")}`;
  }
  return (
    `มาตรฐาน ${std.title} ไม่มีเนื้อหาที่ตรงกับคำถาม "${question}" โดยตรง\n\n` +
    ruleBasedStandardSummary(std)
  );
}

// Orchestrator: LLM first, rule-based fallback on any error.
export async function generateStandardResult(
  std: Standard,
  question?: string,
): Promise<StandardAiResult> {
  const ctx = buildStandardContext(std);
  const provider = getProvider();
  if (provider) {
    try {
      const analysis = await provider.chat([
        {
          role: "system",
          content: question ? buildStandardQaPrompt(ctx, question) : buildStandardSummaryPrompt(ctx),
        },
        {
          role: "user",
          content: question ? `คำถาม: ${question}` : "กรุณาสรุปมาตรฐานนี้",
        },
      ]);
      const trimmed = analysis.trim();
      if (trimmed) return { analysis: trimmed, source: provider.name };
    } catch {
      // fall through to rule-based
    }
  }
  return {
    analysis: question
      ? ruleBasedStandardAnswer(std, question)
      : ruleBasedStandardSummary(std),
    source: "fallback",
  };
}
