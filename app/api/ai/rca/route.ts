import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/lib/queries/permissions";
import { getAsset } from "@/lib/queries/assets";
import { getLatestReadings } from "@/lib/queries/readings";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { getRcaProbabilities } from "@/lib/scoring/rca";
import { generateRcaAnalysis, buildRcaContext } from "@/lib/ai/rca";
import { createRateLimiter, rateKey } from "@/lib/ai/rate-limit";
import { AssetIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Same in-memory limiter pattern as the other AI endpoints (per instance).
const rcaRateLimited = createRateLimiter(20, 15 * 60 * 1000);

// POST { assetId } -> { analysis, source }
export async function POST(request: NextRequest) {
  try {
    // same permission as the page this belongs to: a hidden module must not answer through its API
    if (!(await hasPermission("assets:read"))) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลส่วนนี้" }, { status: 403 });
    const key = await rateKey(request);
    if (rcaRateLimited(key)) {
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

    const [{ oil, vib }, { params }] = await Promise.all([
      getLatestReadings(assetId),
      getAlarmConfig(),
    ]);
    const rca = getRcaProbabilities(oil, vib, params);
    return NextResponse.json(
      await generateRcaAnalysis(buildRcaContext(asset, rca, oil, vib, params)),
    );
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
