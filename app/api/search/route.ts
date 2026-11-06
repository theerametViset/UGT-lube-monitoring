import { NextResponse, type NextRequest } from "next/server";
import { hasPermission } from "@/lib/queries/permissions";
import { globalSearch } from "@/lib/queries/search";
import { SearchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // same permission as the page this belongs to: a hidden module must not answer through its API
  if (!(await hasPermission("assets:read"))) return NextResponse.json({ error: "ไม่มีสิทธิ์ดูข้อมูลส่วนนี้" }, { status: 403 });
  const parsed = SearchQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "invalid query" }, { status: 400 });
  const results = await globalSearch(parsed.data.q);
  return NextResponse.json({ results });
}
