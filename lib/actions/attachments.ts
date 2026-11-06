"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { demoBlocked, runAction, type ActionResult } from "./result";
import { requirePermission } from "./guards";
import { demoCan } from "@/lib/queries/permissions";
import { listStandardAttachments } from "@/lib/queries/attachments";
import type { StandardAttachment } from "@/lib/types";
import {
  DOC_ATTACHMENT_EXTENSIONS,
  DOC_ATTACHMENT_MIME_TYPES,
  LAB_ATTACHMENT_EXTENSIONS,
  LAB_ATTACHMENT_MIME_TYPES,
  MAX_DOC_ATTACHMENT_BYTES,
  MAX_LAB_ATTACHMENT_BYTES,
  validateAttachment,
} from "@/lib/attachment-rules";
import { isLocalStore } from "@/lib/env";
import { isPeriod } from "@/lib/parse/period";
import { deleteLocalAttachment, getLocalAttachment } from "@/lib/local-store";

const BUCKET = "lab-attachments";
const STD_BUCKET = "standard-attachments";

export interface RegisterInput {
  assetId: string;
  period: string;
  kind: "oil" | "vib";
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export async function registerAttachment(input: RegisterInput): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("attachments:write");
  if (!auth.ok) return auth.error;
  const invalid = validateAttachment(input.fileName, input.mimeType, input.sizeBytes, MAX_LAB_ATTACHMENT_BYTES, LAB_ATTACHMENT_MIME_TYPES, LAB_ATTACHMENT_EXTENSIONS);
  if (invalid) return { ok: false, message: invalid };
  // the row must point at this machine's own file (<asset>/<period>/...), in a real period
  if (!isPeriod(input.period)) return { ok: false, message: "งวดไม่ถูกต้อง" };
  if (!input.storagePath.startsWith(`${input.assetId}/${input.period}/`) || input.storagePath.includes("..")) {
    return { ok: false, message: "ตำแหน่งไฟล์ไม่ตรงกับเครื่องจักรนี้" };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("reading_attachments").insert({
    asset_id: input.assetId,
    period: input.period,
    kind: input.kind,
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/assets/${input.assetId}`);
  revalidatePath("/data-entry");
  return { ok: true, message: "แนบไฟล์สำเร็จ" };
  });
}

export async function createDownloadUrl(
  storagePath: string,
): Promise<{ ok: boolean; url?: string; message: string }> {
  if (isLocalStore()) {
    return { ok: true, url: `/api/local-store/file?path=${encodeURIComponent(storagePath)}`, message: "ok" };
  }
  if (isDemoMode()) return { ok: false, message: "ยังไม่มีไฟล์จริง — ต้องเชื่อม Supabase ก่อน" };
  return runAction(async () => {
  const auth = await requirePermission("attachments:read");
  if (!auth.ok) return auth.error;
  // Storage RLS ("lab_att_read") independently re-checks that the caller can
  // access the owning asset's site — this guard only confirms authentication.
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, message: error?.message ?? "สร้างลิงก์ดาวน์โหลดไม่สำเร็จ" };
  }
  return { ok: true, url: data.signedUrl, message: "ok" };
  });
}

export async function deleteAttachment(
  id: string,
  storagePath: string,
  assetId: string,
): Promise<ActionResult> {
  if (isLocalStore()) {
    if (!demoCan("attachments:write")) return { ok: false, message: "ไม่มีสิทธิ์ดำเนินการนี้ (attachments:write)" };
    const row = getLocalAttachment(id);
    if (!row || row.storage_path !== storagePath) return { ok: false, message: "ไม่พบไฟล์แนบ" };
    deleteLocalAttachment(id);
    revalidatePath(`/assets/${assetId}`);
    return { ok: true, message: "ลบไฟล์แนบสำเร็จ (ในเครื่อง)" };
  }
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("attachments:write");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { data: deleted, error } = await supabase.from("reading_attachments").delete().eq("id", id).select("storage_path");
  if (error) return { ok: false, message: error.message };
  if (!deleted?.length) return { ok: false, message: "ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการของโรงงานนี้" };
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([deleted[0].storage_path as string]);
  revalidatePath(`/assets/${assetId}`);
  if (storageErr) {
    console.error("[deleteAttachment] storage removal failed", storageErr);
    return { ok: true, message: "ลบข้อมูลแนบสำเร็จ แต่ไฟล์ในสตอเรจอาจยังไม่ถูกลบ" };
  }
  return { ok: true, message: "ลบไฟล์แนบสำเร็จ" };
  });
}

// ---- Standards attachments (PDF originals in the Standards Library) ----

export interface RegisterStandardInput {
  standardId: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export async function registerStandardAttachment(
  input: RegisterStandardInput,
): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("attachments:write");
  if (!auth.ok) return auth.error;
  const invalid = validateAttachment(input.fileName, input.mimeType, input.sizeBytes, MAX_DOC_ATTACHMENT_BYTES, DOC_ATTACHMENT_MIME_TYPES, DOC_ATTACHMENT_EXTENSIONS);
  if (invalid) return { ok: false, message: invalid };
  if (!input.storagePath.startsWith(`${input.standardId}/`) || input.storagePath.includes("..")) {
    return { ok: false, message: "ตำแหน่งไฟล์ไม่ตรงกับมาตรฐานนี้" };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("standard_attachments").insert({
    standard_id: input.standardId,
    file_name: input.fileName,
    storage_path: input.storagePath,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    uploaded_by: user?.id ?? null,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/standards");
  return { ok: true, message: "แนบไฟล์สำเร็จ" };
  });
}

export async function createStandardDownloadUrl(
  storagePath: string,
): Promise<{ ok: boolean; url?: string; message: string }> {
  if (isDemoMode()) return { ok: false, message: "ยังไม่มีไฟล์จริง — ต้องเชื่อม Supabase ก่อน" };
  return runAction(async () => {
  const auth = await requirePermission("attachments:read");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(STD_BUCKET).createSignedUrl(storagePath, 3600);
  if (error || !data?.signedUrl) {
    return { ok: false, message: error?.message ?? "สร้างลิงก์ดาวน์โหลดไม่สำเร็จ" };
  }
  return { ok: true, url: data.signedUrl, message: "ok" };
  });
}

export async function deleteStandardAttachment(
  id: string,
  storagePath: string,
): Promise<ActionResult> {
  if (isDemoMode()) return demoBlocked();
  return runAction(async () => {
  const auth = await requirePermission("attachments:write");
  if (!auth.ok) return auth.error;
  const supabase = createClient();
  // delete the row first and remove the file it points to, not the path the browser sent
  const { data: deleted, error } = await supabase.from("standard_attachments").delete().eq("id", id).select("storage_path");
  if (error) return { ok: false, message: error.message };
  if (!deleted?.length) return { ok: false, message: "ไม่พบรายการนี้ หรือไม่มีสิทธิ์แก้ไขรายการนี้" };
  const { error: storageErr } = await supabase.storage.from(STD_BUCKET).remove([deleted[0].storage_path as string]);
  revalidatePath("/standards");
  if (storageErr) {
    console.error("[deleteStandardAttachment] storage removal failed", storageErr);
    return { ok: true, message: "ลบข้อมูลแนบสำเร็จ แต่ไฟล์ในสตอเรจอาจยังไม่ถูกลบ" };
  }
  return { ok: true, message: "ลบไฟล์แนบสำเร็จ" };
  });
}

// Client-callable snapshot (the modal lives in a client component).
export async function getStandardAttachments(standardId: string): Promise<StandardAttachment[]> {
  return listStandardAttachments(standardId);
}
