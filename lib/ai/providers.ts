import {
  buildPrompt,
  parseDiagnose,
  type AIProvider,
  type ChatMessage,
  type DiagnoseContext,
  type DiagnoseResult,
} from "./provider";

import { isDemoMode } from "@/lib/env";

const KEY = () => process.env.AI_API_KEY;
const MODEL = () => process.env.AI_MODEL;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<string> {
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`AI HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  return res.text();
}

// OpenAI-compatible chat completions (used by GLM + OpenAI)
async function chatCompletions(
  url: string,
  model: string,
  authHeader: string,
  messages: ChatMessage[],
): Promise<string> {
  const text = await postJson(url, { "Content-Type": "application/json", Authorization: authHeader }, {
    model,
    max_tokens: 1000,
    messages,
  });
  const data = JSON.parse(text);
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI: empty content");
  return content;
}

async function chatComplete(ctx: DiagnoseContext, url: string, model: string, authHeader: string): Promise<DiagnoseResult> {
  return parseDiagnose(await chatCompletions(url, model, authHeader, [{ role: "user", content: buildPrompt(ctx) }]));
}

export const glmProvider: AIProvider = {
  name: "glm",
  async diagnose(ctx) {
    const base = process.env.AI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
    return chatComplete(ctx, `${base}/chat/completions`, MODEL() ?? "glm-4", `Bearer ${KEY()}`);
  },
  async chat(messages) {
    const base = process.env.AI_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4";
    return chatCompletions(`${base}/chat/completions`, MODEL() ?? "glm-4", `Bearer ${KEY()}`, messages);
  },
};

export const openaiProvider: AIProvider = {
  name: "openai",
  async diagnose(ctx) {
    const base = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
    return chatComplete(ctx, `${base}/chat/completions`, MODEL() ?? "gpt-4o", `Bearer ${KEY()}`);
  },
  async chat(messages) {
    const base = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
    return chatCompletions(`${base}/chat/completions`, MODEL() ?? "gpt-4o", `Bearer ${KEY()}`, messages);
  },
};

export const anthropicProvider: AIProvider = {
  name: "anthropic",
  async diagnose(ctx) {
    const base = process.env.AI_BASE_URL ?? "https://api.anthropic.com/v1";
    return parseDiagnose(
      await anthropicChat(`${base}/messages`, [{ role: "user", content: buildPrompt(ctx) }]),
    );
  },
  async chat(messages) {
    const base = process.env.AI_BASE_URL ?? "https://api.anthropic.com/v1";
    return anthropicChat(`${base}/messages`, messages);
  },
};

async function anthropicChat(url: string, messages: ChatMessage[]): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  const text = await postJson(
    url,
    { "Content-Type": "application/json", "x-api-key": KEY() ?? "", "anthropic-version": "2023-06-01" },
    {
      model: MODEL() ?? "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: system || undefined,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    },
  );
  const data = JSON.parse(text);
  const content: string = data?.content?.[0]?.text ?? "";
  if (!content) throw new Error("AI: empty content");
  return content;
}

export function getProvider(): AIProvider | null {
  if (!KEY()) return null;
  // A production Demo deployment has no login: anyone could spend the key. The
  // rule-based fallback answers there instead; `next dev` demo still uses the LLM.
  if (isDemoMode() && process.env.NODE_ENV === "production") return null;
  const which = (process.env.AI_PROVIDER ?? "glm").toLowerCase();
  if (which === "openai") return openaiProvider;
  if (which === "anthropic") return anthropicProvider;
  return glmProvider;
}
