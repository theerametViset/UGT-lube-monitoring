import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/lib/queries/permissions";
import { getAsset } from "@/lib/queries/assets";
import { CompareQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // same permission as the page this belongs to: a hidden module must not answer through its API
  if (!(await hasPermission("assets:read"))) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลส่วนนี้" }, { status: 403 });
  const parsed = CompareQuerySchema.safeParse({ id: request.nextUrl.searchParams.get("id") });
  if (!parsed.success) return NextResponse.json({ error: "id required" }, { status: 400 });
  const asset = await getAsset(parsed.data.id);
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ asset });
}
