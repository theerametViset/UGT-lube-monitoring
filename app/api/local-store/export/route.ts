import { NextResponse } from "next/server";
import { isLocalStore } from "@/lib/env";
import { buildLocalExportSql } from "@/lib/local-store-export";

export const dynamic = "force-dynamic";

// Downloads everything saved in the Local Store as one SQL script for Supabase or a company Postgres server.
export async function GET() {
  if (!isLocalStore()) return NextResponse.json({ message: "Local Store ปิดอยู่" }, { status: 404 });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(buildLocalExportSql(), {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="local-store-export-${stamp}.sql"`,
      "Cache-Control": "no-store",
    },
  });
}
