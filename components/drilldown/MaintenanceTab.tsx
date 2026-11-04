"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Pencil, Trash2, Zap } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { addMaintenance, deleteMaintenance } from "@/lib/actions/maintenance";
import type { MaintenanceRecord } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

export function MaintenanceTab({
  assetId,
  records,
  canManage,
}: {
  assetId: string;
  records: MaintenanceRecord[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const desc = String(fd.get("desc") ?? "").trim();
    if (!desc) {
      toast("กรุณากรอกรายละเอียดงาน", "warning");
      return;
    }
    setBusy(true);
    const res = await addMaintenance({
      assetId,
      type: String(fd.get("type") ?? "pm") as "pm" | "cm",
      work_date: String(fd.get("date") ?? ""),
      wo_no: String(fd.get("wo") ?? "").replace(/^MNT-/, ""),
      description: desc,
      parts: String(fd.get("parts") ?? ""),
      cost: Number(fd.get("cost") ?? 0) || 0,
      technician: String(fd.get("tech") ?? ""),
    });
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
  }

  async function onDelete(id: string) {
    const res = await deleteMaintenance(id, assetId);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <div className={`grid grid-cols-1 gap-3 ${canManage ? "lg:grid-cols-2" : ""}`}>
      {canManage && (
      <Card>
        <h2 className="mb-2.5 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Pencil className="h-4 w-4" aria-hidden />บันทึกการซ่อมบำรุง</h2>
        <form onSubmit={onAdd} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold text-t3">เลขที่ใบงาน</span>
              <input name="wo" defaultValue={`MNT-${19000 + Math.floor(Math.random() * 999)}`} className={INP} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold text-t3">วันที่ดำเนินการ</span>
              <input type="date" name="date" defaultValue="2026-07-01" className={INP} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">ประเภทงานซ่อม</span>
            <select name="type" className={INP} defaultValue="pm">
              <option value="pm">ป้องกันรักษาเชิงรุก (PM)</option>
              <option value="cm">ซ่อมเหตุขัดข้อง (CM)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">รายละเอียดงาน</span>
            <textarea name="desc" rows={3} placeholder="รายละเอียดงาน..." className={INP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">อะไหล่ที่ใช้</span>
            <input name="parts" placeholder="Filter #X123, O-Ring #99" className={INP} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold text-t3">ค่าใช้จ่าย (THB)</span>
              <input type="number" name="cost" min={0} placeholder="0" className={INP} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-bold text-t3">ผู้ปฏิบัติงาน</span>
              <input name="tech" placeholder="ชื่อช่าง" className={INP} />
            </label>
          </div>
          <Button type="submit" variant="primary" disabled={busy} className="w-full justify-center">
            {busy ? "กำลังบันทึก…" : "+ บันทึกข้อมูล"}
          </Button>
        </form>
      </Card>
      )}

      <Card>
        <h2 className="mb-2.5 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><CalendarDays className="h-4 w-4" aria-hidden />ประวัติการซ่อมบำรุง (History Timeline)</h2>
        {records.length === 0 ? (
          <div className="py-4 text-[13px] text-t3">ยังไม่มีประวัติการซ่อมบำรุง</div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div key={r.id} className="flex gap-2">
                <div
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-[14px] ${
                    r.type === "pm" ? "border-green text-green bg-green/10" : "border-red text-red bg-red/10"
                  }`}
                >
                  {r.type === "pm" ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Zap className="h-3.5 w-3.5" aria-hidden />}
                </div>
                <div className="flex-1 rounded-lg border border-border bg-bg3 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-[13px] font-bold ${r.type === "pm" ? "text-green" : "text-red"}`}>
                      {r.type.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[13px] text-t3">{r.work_date} · #{r.wo_no}</span>
                      {canManage && <button aria-label={`ลบรายการซ่อมบำรุงวันที่ ${r.work_date}`} onClick={() => onDelete(r.id)} className="rounded border border-red/30 bg-red/10 px-1 text-[14px] text-red hover:bg-red/20"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>}
                    </span>
                  </div>
                  <div className="text-[14px] text-t2">{r.description}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-t3">Parts: {r.parts || "—"}</span>
                    <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-t3">Cost: {formatCurrency(r.cost || 0)}</span>
                    <span className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[13px] text-t3">Tech: {r.technician || "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
