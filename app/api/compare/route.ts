import { NextResponse, type NextRequest } from "next/server";
import { getAsset } from "@/lib/queries/assets";
import { CompareQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = CompareQuerySchema.safeParse({ id: request.nextUrl.searchParams.get("id") });
  if (!parsed.success) return NextResponse.json({ error: "id required" }, { status: 400 });
  const asset = await getAsset(parsed.data.id);
  if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ asset });
}
