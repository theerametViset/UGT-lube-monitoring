"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, Save, CircleCheck, TriangleAlert, ArrowUp, ArrowDown, PanelLeft } from "lucide-react";
import { Card, Button } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createRole, deleteRole, setRoleMenu, setRolePermissions } from "@/lib/actions/roles";
import { NAV_SECTIONS } from "@/lib/nav";
import type { Permission, Role } from "@/lib/types";
import { readableText } from "@/lib/color";

const MAIN_MENU = NAV_SECTIONS[0].items;
const INP = "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";

export function RolesClient({
  roles,
  permissions,
  grants,
}: {
  roles: Role[];
  permissions: Permission[];
  grants: Record<string, string[]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(roles[0]?.id ?? "");
  const [draft, setDraft] = useState<Set<string>>(new Set(grants[roles[0]?.id ?? ""] ?? []));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  // Sidebar layout of the selected role (roles.menu_main): ordered "งานของฉัน" links + "/admin".
  const [menu, setMenu] = useState<string[]>([]);
  const [menuDirty, setMenuDirty] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    setDraft(new Set(grants[selectedId] ?? []));
    setDirty(false);
  }, [selectedId, grants]);
  useEffect(() => {
    setMenu(selected?.menu_main ?? []);
    setMenuDirty(false);
  }, [selected]);

  function editMenu(next: string[]) {
    setMenu(next);
    setMenuDirty(true);
  }
  function moveMenu(href: string, by: -1 | 1) {
    const i = menu.indexOf(href), j = i + by;
    if (j < 0 || j >= menu.length || menu[j] === "/admin") return;
    const next = [...menu];
    [next[i], next[j]] = [next[j], next[i]];
    editMenu(next);
  }

  async function onSaveMenu() {
    if (!selected) return;
    setMenuSaving(true);
    // No main link picked = the original sidebar ("/admin" alone means nothing then).
    const res = await setRoleMenu(selected.id, menu.some((h) => h !== "/admin") ? menu : []);
    setMenuSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setMenuDirty(false);
      router.refresh();
    }
  }
  const categories = [...new Set(permissions.map((p) => p.category))];

  function toggle(key: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setDirty(true);
  }

  async function onCreate() {
    if (!newId.trim() || !newLabel.trim()) {
      toast("กรุณากรอกรหัสและชื่อ Role", "warning");
      return;
    }
    setBusy(true);
    const res = await createRole(newId, newLabel);
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setAddOpen(false);
      setNewId("");
      setNewLabel("");
      router.refresh();
    }
  }

  async function onDelete() {
    if (!delId) return;
    setBusy(true);
    const res = await deleteRole(delId);
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setDelId(null);
      if (selectedId === delId) setSelectedId(roles.find((r) => r.id !== delId)?.id ?? "");
      router.refresh();
    }
  }

  async function onSave() {
    if (!selected) return;
    setSaving(true);
    const res = await setRolePermissions(selected.id, [...draft]);
    setSaving(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setDirty(false);
      router.refresh();
    }
  }

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><ShieldCheck className="h-4 w-4" aria-hidden />Role &amp; สิทธิ์ (Roles &amp; Permissions)</h2>
            <div className="text-[14px] text-t2">สร้าง Role ใหม่และกำหนดสิทธิ์การใช้งานได้เอง — ไม่ต้องแก้โค้ด</div>
          </div>
          <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>+ สร้าง Role ใหม่</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border p-2 font-sans text-[14px] font-semibold">Role ทั้งหมด ({roles.length})</div>
          <div className="max-h-[520px] overflow-auto">
            {roles.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedId(r.id); }}
                className={`flex cursor-pointer items-center justify-between border-b border-black/[0.025] px-3 py-2.5 text-[14px] transition hover:bg-cyan/[0.04] ${selectedId === r.id ? "bg-cyan/[0.08]" : ""}`}
              >
                <div>
                  <div className="font-semibold">{r.label}</div>
                  <div className="font-mono text-[13px] text-t3">{r.id}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {r.is_system && <span className="badge" style={{ background: "rgba(122,122,122,.12)", color: readableText("#7a7a7a"), border: "1px solid rgba(122,122,122,.3)" }}>ระบบ</span>}
                  {!r.is_system && (
                    <Button size="xs" variant="danger" onClick={(e) => { e.stopPropagation(); setDelId(r.id); }} aria-label="ลบ"><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          {!selected ? (
            <div className="rounded-lg border border-border bg-black/[0.02] p-4 text-center text-[13px] text-t3">
              เลือก Role ทางซ้ายเพื่อดู/แก้ไขสิทธิ์
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                <div>
                  <h2 className="font-sans text-[18px] max-sm:text-[16px] font-semibold">{selected.label}</h2>
                  <div className="text-[13px] text-t3">เลือกสิทธิ์ที่ Role นี้ทำได้ — บันทึกจะแทนที่สิทธิ์เดิมทั้งหมด</div>
                </div>
                <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={onSave}>
                  {saving ? "กำลังบันทึก…" : <><Save className="h-3.5 w-3.5" aria-hidden />บันทึกสิทธิ์</>}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {categories.map((cat) => (
                  <div key={cat} className="rounded-md border border-border p-2.5">
                    <div className="mb-1.5 text-[13px] font-bold text-t3">{cat}</div>
                    <div className="space-y-1">
                      {permissions.filter((p) => p.category === cat).map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-start gap-2 text-[14px]">
                          <input
                            type="checkbox"
                            checked={draft.has(p.key)}
                            onChange={() => toggle(p.key)}
                            className="mt-0.5"
                          />
                          <span>
                            {p.label}
                            <span className="ml-1 font-mono text-[13px] text-t3">({p.key})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* View only: which main-menu links sit on top of this role's sidebar. Grants nothing. */}
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 font-sans text-[16px] font-semibold"><PanelLeft className="h-4 w-4" aria-hidden />เมนูใน Sidebar ของ Role นี้</h3>
                    <div className="text-[13px] text-t3">ติ๊กเมนูที่จะอยู่ในกลุ่ม &quot;งานของฉัน&quot; ด้านบน แล้วเรียงลำดับ — ที่เหลือพับไว้ใน &quot;อื่นๆ&quot; · จัดมุมมองอย่างเดียว ไม่เปลี่ยนสิทธิ์ · ไม่ติ๊กเลย = เมนูแบบเดิม</div>
                  </div>
                  <Button size="sm" variant="primary" disabled={!menuDirty || menuSaving} onClick={onSaveMenu}>
                    {menuSaving ? "กำลังบันทึก…" : <><Save className="h-3.5 w-3.5" aria-hidden />บันทึกเมนู</>}
                  </Button>
                </div>
                <div className="space-y-1">
                  {[...menu.filter((h) => h !== "/admin").flatMap((h) => MAIN_MENU.filter((i) => i.href === h)), ...MAIN_MENU.filter((i) => !menu.includes(i.href))].map((item) => {
                    const on = menu.includes(item.href);
                    const at = menu.indexOf(item.href);
                    return (
                      <div key={item.href} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[14px] ${on ? "border-cyan/40 bg-cyan/[0.04]" : "border-border"}`}>
                        <label className="flex flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => editMenu(on ? menu.filter((h) => h !== item.href) : [...menu.filter((h) => h !== "/admin"), item.href, ...menu.filter((h) => h === "/admin")])}
                          />
                          <item.icon className="h-3.5 w-3.5 text-t3" aria-hidden />
                          <span>{item.label}</span>
                          <span className="text-[13px] text-t3">{on ? `งานของฉัน #${at + 1}` : "อื่นๆ"}</span>
                          {item.perm && !draft.has(item.perm) && <span className="text-[12px] text-yellow">(ไม่มีสิทธิ์ — ไม่แสดง)</span>}
                        </label>
                        {on && (
                          <span className="flex gap-1">
                            <Button size="xs" variant="ghost" disabled={at === 0} onClick={() => moveMenu(item.href, -1)} aria-label={`เลื่อน ${item.label} ขึ้น`}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></Button>
                            <Button size="xs" variant="ghost" disabled={menu[at + 1] === undefined || menu[at + 1] === "/admin"} onClick={() => moveMenu(item.href, 1)} aria-label={`เลื่อน ${item.label} ลง`}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></Button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <label className="flex cursor-pointer items-center gap-2 px-2.5 pt-1 text-[14px]">
                    <input
                      type="checkbox"
                      checked={menu.includes("/admin")}
                      disabled={menu.every((h) => h === "/admin") && !menu.includes("/admin")}
                      onChange={() => editMenu(menu.includes("/admin") ? menu.filter((h) => h !== "/admin") : [...menu, "/admin"])}
                    />
                    กางหมวด &quot;ผู้ดูแลระบบ (Admin)&quot; ไว้ตั้งแต่แรก
                    <span className="text-[13px] text-t3">(เห็นเฉพาะเมนูที่ Role นี้มีสิทธิ์)</span>
                  </label>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="+ สร้าง Role ใหม่">
        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">รหัส Role (ภาษาอังกฤษ, ไม่มีเว้นวรรค) *</span>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="technician" className={INP} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-t3">ชื่อที่แสดง *</span>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="ช่างเทคนิค (Technician)" className={INP} />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setAddOpen(false)}>ยกเลิก</Button>
            <Button variant="primary" disabled={busy} onClick={onCreate}>{busy ? "กำลังสร้าง…" : <><CircleCheck className="h-3.5 w-3.5" aria-hidden />สร้าง</>}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!delId} onClose={() => setDelId(null)} title={<span className="flex items-center gap-1.5"><TriangleAlert className="h-4 w-4" aria-hidden />ยืนยันการลบ Role</span>}>
        <div className="mb-3.5 text-[14px] text-t2">ลบ Role &quot;{delId}&quot;? (ไม่สามารถย้อนกลับได้ — ต้องไม่มีผู้ใช้คนใดใช้ role นี้อยู่)</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDelId(null)}>ยกเลิก</Button>
          <Button variant="danger" disabled={busy} onClick={onDelete}>{busy ? "กำลังลบ…" : <><Trash2 className="h-3.5 w-3.5" aria-hidden />ยืนยันลบ</>}</Button>
        </div>
      </Modal>
    </div>
  );
}
