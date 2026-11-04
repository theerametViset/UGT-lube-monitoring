import { NextResponse, type NextRequest } from "next/server";
import { getStandard } from "@/lib/queries/standards";
import { generateStandardResult } from "@/lib/ai/standard";
import { createRateLimiter, rateKey } from "@/lib/ai/rate-limit";
import { StandardQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Same in-memory limiter pattern as the other AI endpoints (per instance).
const standardRateLimited = createRateLimiter(20, 15 * 60 * 1000);

// POST { id, question? } -> { analysis, source }
export async function POST(request: NextRequest) {
  try {
    const key = await rateKey(request);
    if (standardRateLimited(key)) {
      return NextResponse.json(
        { error: "Too many requests — กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }

    const parsed = StandardQuerySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { id, question } = parsed.data;

    const std = await getStandard(id);
    if (!std) return NextResponse.json({ error: "standard not found" }, { status: 404 });

    return NextResponse.json(await generateStandardResult(std, question || undefined));
  } catch (e) {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
