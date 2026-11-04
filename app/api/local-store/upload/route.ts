import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { isLocalStore } from "@/lib/env";
import { addLocalAttachment } from "@/lib/local-store";
import { isDemoAssetId } from "@/lib/demo-data";
import { isPeriod } from "@/lib/parse/period";
import { sanitizeFileName } from "@/lib/format";
import {
  LAB_ATTACHMENT_EXTENSIONS,
  LAB_ATTACHMENT_MIME_TYPES,
  MAX_LAB_ATTACHMENT_BYTES,
  validateAttachment,
} from "@/lib/attachment-rules";

export const dynamic = "force-dynamic";

// Local Store stand-in for "upload to the lab-attachments bucket + registerAttachment()".
// Same validation as the real path; the row lands in reading_attachments.json.
export async function POST(request: NextRequest) {
  if (!isLocalStore()) return NextResponse.json({ ok: false, message: "Local Store ปิดอยู่" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  const assetId = String(form.get("assetId") ?? "");
  const period = String(form.get("period") ?? "");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, message: "ไม่พบไฟล์" }, { status: 400 });
  if (!isPeriod(period) || (kind !== "oil" && kind !== "vib")) {
    return NextResponse.json({ ok: false, message: "ข้อมูลงวด/ชนิดไม่ถูกต้อง" }, { status: 400 });
  }
  if (!isDemoAssetId(assetId)) {
    return NextResponse.json({ ok: false, message: "ไม่พบเครื่องจักร" }, { status: 400 });
  }
  const invalid = validateAttachment(
    file.name,
    file.type || null,
    file.size,
    MAX_LAB_ATTACHMENT_BYTES,
    LAB_ATTACHMENT_MIME_TYPES,
    LAB_ATTACHMENT_EXTENSIONS,
  );
  if (invalid) return NextResponse.json({ ok: false, message: invalid }, { status: 400 });

  // Same path layout as the Supabase bucket (<asset>/<period>/<ts>-<name>), so an export can re-upload as-is.
  const storagePath = `${sanitizeFileName(assetId)}/${period}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const row = addLocalAttachment(
    {
      asset_id: assetId,
      period,
      kind,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
    },
    Buffer.from(await file.arrayBuffer()),
  );
  revalidatePath(`/assets/${assetId}`);
  return NextResponse.json({ ok: true, id: row.id, message: "แนบไฟล์สำเร็จ (ในเครื่อง)" });
}
