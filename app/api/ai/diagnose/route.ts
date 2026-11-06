import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/lib/queries/permissions";
import { getAsset } from "@/lib/queries/assets";
import { getLatestReadings } from "@/lib/queries/readings";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { getProvider } from "@/lib/ai/providers";
import { ruleBasedDiagnose } from "@/lib/ai/fallback";
import type { DiagnoseContext, DiagnoseParam } from "@/lib/ai/provider";

import { createRateLimiter, rateKey } from "@/lib/ai/rate-limit";
import { AssetIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Cheap in-memory rate limiter (per signed-in user) to cap AI spend.
const aiRateLimited = createRateLimiter(20, 15 * 60 * 1000);

// POST { assetId } -> DiagnoseResult (+ _source: 'glm'|'openai'|'anthropic'|'fallback')
export async function POST(request: NextRequest) {
  try {
    // same permission as the page this belongs to: a hidden module must not answer through its API
    if (!(await hasPermission("assets:read"))) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลส่วนนี้" }, { status: 403 });
    const key = await rateKey(request);
    if (aiRateLimited(key)) {
      return NextResponse.json(
        { error: "Too many requests — กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }

    const parsed = AssetIdSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "assetId required" }, { status: 400 });
    const { assetId } = parsed.data;

    const asset = await getAsset(assetId);
    if (!asset) return NextResponse.json({ error: "asset not found" }, { status: 404 });

    const { oil, vib } = await getLatestReadings(assetId);
    const { params } = await getAlarmConfig();

    const ctx: DiagnoseContext = {
      asset: { id: asset.id, name: asset.name, type: asset.type, site: asset.site, health: asset.health, status: asset.status },
      oil: (oil ?? null) as Record<string, number | string | null> | null,
      vib: (vib ?? null) as Record<string, number | string | null> | null,
      params: params as DiagnoseParam[],
    };

    const provider = getProvider();
    if (provider) {
      try {
        const result = await provider.diagnose(ctx);
        return NextResponse.json({ ...result, _source: provider.name });
      } catch {
        // fall through to rule-based on any provider error
      }
    }
    const result = ruleBasedDiagnose(ctx);
    return NextResponse.json({ ...result, _source: "fallback" });
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
