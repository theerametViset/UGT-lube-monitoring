import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { isLocalStore } from "@/lib/env";
import { allLocalAttachments, localFilePath } from "@/lib/local-store";

export const dynamic = "force-dynamic";

// Local Store stand-in for a signed download URL from the lab-attachments bucket.
export async function GET(request: NextRequest) {
  if (!isLocalStore()) return NextResponse.json({ message: "Local Store ปิดอยู่" }, { status: 404 });
  const storagePath = request.nextUrl.searchParams.get("path") ?? "";
  // only files that have a reading_attachments row — never an arbitrary path
  const row = allLocalAttachments().find((a) => a.storage_path === storagePath);
  const full = row ? localFilePath(row.storage_path) : null;
  if (!row || !full || !fs.existsSync(full)) return NextResponse.json({ message: "ไม่พบไฟล์" }, { status: 404 });
  return new NextResponse(fs.readFileSync(full), {
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
      "Cache-Control": "no-store",
    },
  });
}
