// Shared display formatters — avoids re-implementing the same `฿${n.toLocaleString()}`
// pattern independently across client components.
export function formatCurrency(amount: number): string {
  return `฿${amount.toLocaleString()}`;
}

// Shared upload-filename sanitizer — used by every attachment upload panel
// before building the storage path, so an uploaded file's name can't introduce
// unexpected characters into the object key.
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 80);
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes === 0) return "0 KB";
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export function formatThaiDateTime(date: Date = new Date()): string {
  return date.toLocaleString("th-TH");
}
