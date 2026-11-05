"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Table2, Trash2, TriangleAlert } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteReading } from "@/lib/actions/readings";

type Row = { period: string } & Record<string, number | string | null>;
export interface ReadingColumn { key: string; label: string }

// The saved readings of one kind, newest first, with a delete per period for readings:write
// (a reading saved on the wrong machine or month). The Health Score is recomputed server-side.
export function ReadingsTable({ assetId, kind, rows, columns, canDelete }: {
  assetId: string;
  kind: "oil" | "vib";
  rows: Row[];
  columns: ReadingColumn[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (rows.length === 0) return null;

  async function onDelete() {
    if (!confirm) return;
    setBusy(true);
    const res = await deleteReading({ assetId, period: confirm, kind });
    setBusy(false);
    setConfirm(null);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) router.refresh();
  }

  const name = kind === "oil" ? "น้ำมัน" : "สั่นสะเทือน";
  return (
    <Card className="mb-3">
      <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold">
        <Table2 className="h-4 w-4" aria-hidden />ผลตรวจ{name}ที่บันทึก <span className="text-[13px] font-medium text-t3">({rows.length} งวด)</span>
      </h2>
      <div className="max-h-[320px] overflow-auto">
        <table className="w-full text-[14px]">
          <thead className="sticky top-0 bg-bg2">
            <tr className="border-b border-border text-left text-[13px] text-t3">
              <th scope="col" className="py-1.5 pr-3">งวด</th>
              {columns.map((c) => <th key={c.key} scope="col" className="py-1.5 pr-3 text-right">{c.label}</th>)}
              {canDelete && <th scope="col" className="py-1.5"><span className="sr-only">ลบ</span></th>}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.period} className="border-b border-border/50">
                <td className="py-1.5 pr-3 font-mono">{r.period}</td>
                {columns.map((c) => <td key={c.key} className="py-1.5 pr-3 text-right font-mono tabular-nums">{r[c.key] ?? "—"}</td>)}
                {canDelete && (
                  <td className="py-1 text-right">
                    <Button size="xs" variant="ghost" onClick={() => setConfirm(r.period)} aria-label={`ลบผล${name} งวด ${r.period}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={<span className="flex items-center gap-1.5"><TriangleAlert className="h-4 w-4" aria-hidden />ยืนยันลบผล{name}</span>}>
        <div className="mb-3.5 text-[14px] text-t2">
          ลบผล{name}ของ <b className="text-t1">{assetId}</b> งวด <b className="text-t1">{confirm}</b>? ระบบจะคำนวณ Health Score ใหม่จากผลที่เหลือ · ไฟล์แนบของงวดนี้ยังอยู่ · ย้อนกลับไม่ได้ (มีบันทึกใน Audit Trail)
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>ยกเลิก</Button>
          <Button variant="danger" disabled={busy} onClick={onDelete}>
            {busy ? "กำลังลบ…" : <><Trash2 className="h-3.5 w-3.5" aria-hidden />ยืนยันลบ</>}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
