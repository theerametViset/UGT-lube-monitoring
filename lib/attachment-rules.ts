// Shared by the Server Actions (lib/actions/attachments.ts) and the Local Store upload route.

// Mirrors the storage-bucket file_size_limit/allowed_mime_types set in
// supabase/0022_attachment_bucket_limits.sql — that migration is the real
// enforcement (a direct upload can't bypass it); this is a defense-in-depth
// check so a crafted registerX call can't record metadata that could never
// have matched a file the bucket would actually have accepted.
export const MAX_LAB_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const LAB_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);
export const LAB_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".xlsx", ".xls", ".csv"]);
export const MAX_DOC_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const DOC_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);
export const DOC_ATTACHMENT_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"]);

// Real enforcement is the storage-bucket file_size_limit/allowed_mime_types
// set in supabase/0022_attachment_bucket_limits.sql — this is defense in
// depth so a crafted registerX call can't record metadata that could never
// have matched a file the bucket would actually accept. Both checks fail
// CLOSED on missing data (null size/mime are rejected, not skipped) since a
// real upload from the browser always knows the file's size, and a missing
// mime type falls back to the file extension instead of bypassing the check.
export function validateAttachment(
  fileName: string,
  mimeType: string | null,
  sizeBytes: number | null,
  maxBytes: number,
  allowedTypes: Set<string>,
  allowedExtensions: Set<string>,
): string | null {
  if (sizeBytes == null) return "ไม่ทราบขนาดไฟล์";
  if (sizeBytes > maxBytes) return `ไฟล์ใหญ่เกิน ${Math.round(maxBytes / (1024 * 1024))}MB`;
  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  const typeOk = mimeType ? allowedTypes.has(mimeType) : allowedExtensions.has(ext);
  if (!typeOk) return "ชนิดไฟล์ไม่ได้รับอนุญาต";
  return null;
}
