"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Bell, Eye, FlaskConical, Send } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { previewWeeklyDigest, saveNotificationConfig, sendWeeklyDigestNow } from "@/lib/actions/notifications";
import type { NotificationConfig } from "@/lib/types";

const INP = "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

const TOGGLES: { key: keyof NotificationConfig; label: string; hint: string }[] = [
  { key: "enable_critical_alerts", label: "แจ้งเตือนเมื่อเครื่องจักรวิกฤต (Critical Alerts)", hint: "ส่งอีเมลทันทีเมื่อมีเครื่องจักรเข้าสถานะ Critical" },
  { key: "enable_weekly_summary", label: "สรุปรายสัปดาห์ (Weekly Summary)", hint: "ส่งสรุปภาพรวมกองเครื่องจักรทุกสัปดาห์" },
];

export function NotificationConfigClient({ initialConfig }: { initialConfig: NotificationConfig }) {
  const router = useRouter();
  const toast = useToast();
  const [fromEmail, setFromEmail] = useState(initialConfig.from_email);
  const [recipients, setRecipients] = useState(initialConfig.email_recipients.join(", "));
  const [toggles, setToggles] = useState({
    enable_critical_alerts: initialConfig.enable_critical_alerts,
    enable_weekly_summary: initialConfig.enable_weekly_summary,
  });
  const [saving, setSaving] = useState(false);
  // Weekly digest by hand: preview (nothing sent), test send, send to everyone now.
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"" | "preview" | "test" | "all">("");
  const [confirmAll, setConfirmAll] = useState(false);
  const saved = initialConfig.email_recipients;
  const recipientsEdited = recipients.split(/[,;]/).map((s) => s.trim()).filter(Boolean).join(",") !== saved.join(",");

  async function onPreview() {
    setBusy("preview");
    const res = await previewWeeklyDigest();
    setBusy("");
    if (res.ok && res.html) setPreview({ subject: res.subject ?? "", html: res.html });
    else toast(res.message, "error");
  }
  async function onSend(test: boolean) {
    setBusy(test ? "test" : "all");
    const res = await sendWeeklyDigestNow({ test, to: testTo });
    setBusy("");
    setConfirmAll(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
  }

  function toggle(key: keyof typeof toggles) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSave() {
    setSaving(true);
    const res = await saveNotificationConfig({
      from_email: fromEmail,
      email_recipients: recipients.split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 20),
      ...toggles,
    });
    setSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) router.refresh();
  }

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><Mail className="h-4 w-4" aria-hidden />ตั้งค่าการแจ้งเตือนอีเมล (Notification Settings)</h2>
            <div className="text-[14px] text-t2">กำหนดผู้รับอีเมลและประเภทการแจ้งเตือนอัตโนมัติของระบบ</div>
          </div>
          <Button size="sm" variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "กำลังบันทึก…" : <><Save className="h-3.5 w-3.5" aria-hidden />บันทึก</>}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">อีเมลผู้ส่ง (From Email) *</span>
            <input value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="alerts@ugt-reliability.com" className={INP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">ผู้รับอีเมล (คั่นด้วย , หรือ ;)</span>
            <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="engineer@ugt.co.th, manager@ugt.co.th" className={INP} />
          </label>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Bell className="h-4 w-4" aria-hidden />ประเภทการแจ้งเตือน</h2>
        <div className="space-y-2">
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5">
              <input
                type="checkbox"
                checked={toggles[t.key as keyof typeof toggles]}
                onChange={() => toggle(t.key as keyof typeof toggles)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-[14px] font-semibold text-t1">{t.label}</span>
                <span className="block text-[13px] text-t3">{t.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold"><Send className="h-4 w-4" aria-hidden />ส่งสรุปรายสัปดาห์ด้วยตัวเอง</h2>
        <div className="mb-3 text-[13px] text-t3">อีเมลฉบับเดียวกับที่ระบบส่งอัตโนมัติทุกวันจันทร์ 13:00 · ใช้ข้อมูลล่าสุดของทุกโรงงาน</div>
        <div className="space-y-3">
          <div>
            <Button size="sm" variant="ghost" onClick={onPreview} disabled={!!busy}>
              <Eye className="h-3.5 w-3.5" aria-hidden />{busy === "preview" ? "กำลังสร้าง…" : "ดูตัวอย่าง (ยังไม่ส่ง)"}
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1">
              <span className="mb-1 block text-[13px] font-bold text-t3">ส่งทดสอบถึง (สูงสุด 3 อีเมล · หัวเรื่องขึ้นต้น [ทดสอบ])</span>
              <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@ube.co.th" className={INP} />
            </label>
            <Button size="sm" variant="ghost" onClick={() => onSend(true)} disabled={!!busy || !testTo.trim()}>
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />{busy === "test" ? "กำลังส่ง…" : "ส่งทดสอบ"}
            </Button>
          </div>
          <div>
            <Button size="sm" variant="primary" onClick={() => setConfirmAll(true)} disabled={!!busy || saved.length === 0}>
              <Send className="h-3.5 w-3.5" aria-hidden />ส่งให้ผู้รับทั้งหมดเดี๋ยวนี้ ({saved.length} คน)
            </Button>
            {saved.length === 0 && <span className="ml-2 text-[13px] text-t3">ยังไม่มีผู้รับที่บันทึกไว้</span>}
          </div>
        </div>
      </Card>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="ตัวอย่างอีเมลสรุปรายสัปดาห์" maxWidth={680}>
        {preview && (
          <div className="space-y-2">
            <div className="text-[14px]"><span className="text-t3">หัวเรื่อง: </span><span className="font-semibold">{preview.subject}</span></div>
            {/* sandbox="": the email HTML renders with no scripts and no access to this page */}
            <iframe title="ตัวอย่างอีเมล" sandbox="" srcDoc={preview.html} className="h-[65vh] w-full rounded-lg border border-border bg-white" />
          </div>
        )}
      </Modal>

      <Modal open={confirmAll} onClose={() => setConfirmAll(false)} title="ยืนยันส่งสรุปรายสัปดาห์">
        <div className="mb-3 space-y-1.5 text-[14px] text-t2">
          <div>ส่งถึงผู้รับที่บันทึกไว้ <b className="text-t1">{saved.length} คน</b> ตอนนี้?</div>
          <div className="break-all text-[13px] text-t3">{saved.join(", ")}</div>
          {recipientsEdited && <div className="text-[13px] text-yellow">มีรายชื่อที่แก้แต่ยังไม่บันทึก — จะส่งตามรายชื่อที่บันทึกไว้ด้านบนนี้</div>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmAll(false)}>ยกเลิก</Button>
          <Button variant="primary" disabled={!!busy} onClick={() => onSend(false)}>
            <Send className="h-3.5 w-3.5" aria-hidden />{busy === "all" ? "กำลังส่ง…" : "ยืนยันส่ง"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
