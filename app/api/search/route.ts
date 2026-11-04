import { NextResponse, type NextRequest } from "next/server";
import { globalSearch } from "@/lib/queries/search";
import { SearchQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const parsed = SearchQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "invalid query" }, { status: 400 });
  const results = await globalSearch(parsed.data.q);
  return NextResponse.json({ results });
}
