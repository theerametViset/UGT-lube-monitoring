import { NextResponse, type NextRequest } from "next/server";
import { getDashboardData } from "@/lib/queries/assets";
import { generateExecSummary } from "@/lib/ai/exec-summary";
import { createRateLimiter, rateKey } from "@/lib/ai/rate-limit";

export const dynamic = "force-dynamic";

// Same in-memory limiter as the other AI endpoints (per server instance).
const execRateLimited = createRateLimiter(20, 15 * 60 * 1000);

// POST -> { summary, source } — executive summary written from real fleet KPIs.
export async function POST(request: NextRequest) {
  try {
    const key = await rateKey(request);
    if (execRateLimited(key)) {
      return NextResponse.json(
        { error: "Too many requests — กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }

    const { data } = await getDashboardData("");
    return NextResponse.json(await generateExecSummary(data));
  } catch {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
