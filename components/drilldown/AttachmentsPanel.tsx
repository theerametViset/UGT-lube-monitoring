"use client";

import { useState } from "react";
import { Activity, Download, Droplet, Image as ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { createDownloadUrl, deleteAttachment } from "@/lib/actions/attachments";
import { isImage } from "@/lib/parse/excel-utils";
import type { ReadingAttachment } from "@/lib/types";

export function AttachmentsPanel({
  assetId,
  attachments,
  canManage = false,
}: {
  assetId: string;
  attachments: ReadingAttachment[];
  canManage?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<string>("");

  async function onDownload(path: string) {
    setBusy(path);
    const res = await createDownloadUrl(path);
    setBusy("");
    if (res.ok && res.url) {
      window.open(res.url, "_blank");
    } else {
      toast(res.message, "error");
    }
  }

  async function onDelete(a: ReadingAttachment) {
    setBusy(a.id);
    const res = await deleteAttachment(a.id, a.storage_path, assetId);
    setBusy("");
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
  }

  if (attachments.length === 0) {
    return <div className="text-[13px] text-t3">ยังไม่มีไฟล์แนบ</div>;
  }

  return (
    <div className="space-y-1">
      {attachments.map((a) => {
        const isImg = isImage({ name: a.file_name, type: a.mime_type ?? "", size: 0 } as File);
        const FileIcon = isImg ? ImageIcon : a.kind === "oil" ? Droplet : a.kind === "vib" ? Activity : Paperclip;
        return (
          <div
            key={a.id}
            className="flex items-center justify-between rounded border border-border bg-bg3 px-2 py-1 text-[14px]"
          >
            <span className="min-w-0 flex items-center gap-2">
              <FileIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{a.file_name}</span>
              <span className="text-t3">
                {a.size_bytes ? `(${(a.size_bytes / 1024).toFixed(0)} KB)` : ""}
              </span>
            </span>
            <span className="flex gap-1">
              <Button size="xs" variant="ghost" onClick={() => onDownload(a.storage_path)}><Download className="h-3.5 w-3.5" aria-hidden /></Button>
              {canManage && <Button size="xs" variant="danger" onClick={() => onDelete(a)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
