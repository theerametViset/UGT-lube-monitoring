"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Bell } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";
import { saveNotificationConfig } from "@/lib/actions/notifications";
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
            <h2 className="flex items-center gap-1.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><Mail className="h-4 w-4" aria-hidden />ตั้งค่าการแจ้งเตือนอีเมล (Notification Settings)</h2>
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
    </div>
  );
}
