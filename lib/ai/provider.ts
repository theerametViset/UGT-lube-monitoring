import { z } from "zod";

export const DiagnoseResultSchema = z.object({
  summary: z.string(),
  primaryAnomaly: z.string(),
  confidencePct: z.number(),
  oilAnalysis: z.string(),
  vibrationAnalysis: z.string(),
  rootCauseHypothesis: z.string(),
  actionPlan: z.object({
    immediate: z.array(z.string()),
    shortTerm: z.array(z.string()),
    longTerm: z.array(z.string()),
  }),
});
export type DiagnoseResult = z.infer<typeof DiagnoseResultSchema>;

export interface DiagnoseParam {
  category: string;
  key: string;
  name: string;
  unit: string | null;
  warn_limit: number | null;
  crit_limit: number | null;
}

export interface DiagnoseContext {
  asset: {
    id: string;
    name: string;
    type: string;
    site: string;
    health: number;
    status: string;
  };
  oil: Record<string, number | string | null> | null;
  vib: Record<string, number | string | null> | null;
  params: DiagnoseParam[];
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  name: string;
  diagnose(ctx: DiagnoseContext): Promise<DiagnoseResult>;
  /** Free-form multi-turn chat (RCA, exec summary, standards). Returns plain text. */
  chat(messages: ChatMessage[]): Promise<string>;
}

export function buildPrompt(ctx: DiagnoseContext): string {
  const o = ctx.oil ?? {};
  const v = ctx.vib ?? {};
  return [
    `คุณคือ Chief Predictive Maintenance Reliability Officer ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น`,
    `เครื่องจักร: ${ctx.asset.name} (${ctx.asset.type}) | โรงงาน: ${ctx.asset.site} | Health: ${ctx.asset.health}% | Status: ${ctx.asset.status}`,
    `Fe: ${o.fe ?? "N/A"} ppm | Viscosity: ${o.visc ?? "N/A"} cSt | Water: ${o.water ?? "N/A"} ppm | TAN: ${o.tan ?? "N/A"} | ISO: ${o.iso_code ?? "N/A"}`,
    `Velocity RMS: ${v.vel ?? "N/A"} mm/s | Peak Accel: ${v.acc ?? "N/A"} g-PK | Bearing Temp: ${v.temp ?? "N/A"}°C`,
    `Output JSON: {"summary":"...","primaryAnomaly":"...","confidencePct":85,"oilAnalysis":"...","vibrationAnalysis":"...","rootCauseHypothesis":"...","actionPlan":{"immediate":["..."],"shortTerm":["..."],"longTerm":["..."]}}`,
  ].join("\n");
}

export function parseDiagnose(text: string): DiagnoseResult {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const obj = JSON.parse(cleaned);
  return DiagnoseResultSchema.parse(obj);
}
