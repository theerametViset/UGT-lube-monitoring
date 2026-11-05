"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Users, Download, ShieldCheck, Pencil, Trash2, Factory, CircleCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, Button, ButtonLink } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { deleteUser, getUsersForExport, updateUserRole } from "@/lib/actions/users";
import { useXlsxExport } from "@/lib/hooks/useXlsxExport";
import type { Role, Site } from "@/lib/types";

const INP =
  "w-full rounded-lg border border-border bg-bg2 px-2.5 py-1.5 text-[14px] outline-none focus:border-cyan";
const PAGE_SIZES = [20, 50, 100];

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  site_access: string[];
  created_at: string;
}

const ROLE_CLS: Record<string, string> = {
  admin: "badge-crit",
  engineer: "",
  manager: "badge-warn",
  viewer: "badge-ok",
};

function hrefFor(base: Record<string, string>, over: Record<string, string | number>) {
  const p = new URLSearchParams();
  for (const k of ["q", "pageSize"]) {
    const v = over[k] ?? base[k];
    if (v) p.set(k, String(v));
  }
  if (over.page && Number(over.page) > 1) p.set("page", String(over.page));
  const qs = p.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export function UsersClient({
  list,
  q,
  roles,
  sites,
}: {
  list: { rows: UserRow[]; total: number; page: number; pages: number; pageSize: number };
  q: string;
  roles: Role[];
  sites: Site[];
}) {
  const router = useRouter();
  const toast = useToast();
  const base = { q, pageSize: String(list.pageSize) };
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("");
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [qInput, setQInput] = useState(q);
  const qTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setQInput(q), [q]);

  // Clear any pending debounced navigation if the component unmounts before
  // it fires — otherwise it can call router.push() after unmount.
  useEffect(() => () => { if (qTimer.current) clearTimeout(qTimer.current); }, []);

  function nav(over: Record<string, string | number>) {
    router.push(hrefFor(base, { ...over, page: 1 }));
  }

  function onSearchChange(v: string) {
    setQInput(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => nav({ q: v }), 350);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setRole(u.role);
    setSelectedSites(u.site_access);
  }

  async function onSave() {
    if (!editing) return;
    setBusy(true);
    const res = await updateUserRole(editing.id, role, selectedSites);
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setEditing(null);
      router.refresh();
    }
  }

  async function onDelete() {
    if (!delId) return;
    setBusy(true);
    const res = await deleteUser(delId);
    setBusy(false);
    toast(res.message, res.ok ? "success" : res.demo ? "info" : "error");
    if (res.ok) {
      setDelId(null);
      router.refresh();
    }
  }

  const { exporting, run: onExport } = useXlsxExport(() => getUsersForExport(q), {
    filenamePrefix: "users",
    sheet: "Users",
    headers: ["Email", "Full Name", "Role", "Site Access", "Created At"],
    mapRow: (u) => [u.email, u.full_name, u.role, u.site_access.length ? u.site_access.join(", ") : "ทุก Site", u.created_at],
  });

  function toggleSite(code: string) {
    setSelectedSites((prev) => (prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]));
  }

  return (
    <div className="fade space-y-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="page-title flex items-center gap-2.5 font-sans text-[22px] max-sm:text-[18px] font-bold"><Users className="h-4 w-4" aria-hidden />จัดการผู้ใช้ (User Management)</h2>
            <div className="text-[14px] text-t2">ดู/แก้บทบาท/ลบผู้ใช้ทั้งหมดในระบบ</div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={onExport} disabled={exporting}>{exporting ? "กำลังส่งออก…" : <><Download className="h-3.5 w-3.5" aria-hidden />Excel</>}</Button>
            <ButtonLink href="/admin/roles" size="sm" variant="ghost"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />จัดการ Role &amp; สิทธิ์</ButtonLink>
          </div>
        </div>
        <div className="mt-2.5 border-t border-border pt-2.5">
          <input
            value={qInput}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="ค้นหาอีเมล หรือชื่อ..."
            className="w-full max-w-[320px] rounded-pill border border-border bg-bg2 px-3 py-1.5 text-[14px] outline-none focus:border-cyan"
          />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-[14px] font-semibold text-t1">รายชื่อผู้ใช้ <span className="font-normal text-t3">({list.total} คน)</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-border bg-black/[0.015] text-[13px] text-t3">
                <th scope="col" className="px-2.5 py-2">อีเมล</th>
                <th scope="col">ชื่อ</th>
                <th scope="col">บทบาท</th>
                <th scope="col">Site Access</th>
                <th scope="col">วันที่สมัคร</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {list.rows.length === 0 ? (
                <tr><td colSpan={6} className="px-2.5 py-6 text-center text-[13px] text-t3">ไม่พบผู้ใช้ที่ตรงกับเงื่อนไข</td></tr>
              ) : list.rows.map((u) => (
                <tr key={u.id} className="border-b border-black/[0.025] hover:bg-cyan/[0.025]">
                  <td className="px-2.5 py-2 font-mono text-cyan">{u.email}</td>
                  <td className="font-medium">{u.full_name ?? "—"}</td>
                  <td>
                    <span className={`badge ${ROLE_CLS[u.role] ?? ""}`} style={ROLE_CLS[u.role] ? {} : { background: "rgba(0,102,204,.12)", color: "#0066cc", border: "1px solid rgba(0,102,204,.3)" }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="text-t3">{u.site_access.length === 0 ? "ทุก Site" : u.site_access.join(", ")}</td>
                  <td className="font-mono text-t3">{u.created_at?.slice(0, 10)}</td>
                  <td className="px-2.5">
                    <div className="flex gap-1">
                      <Button size="xs" variant="ghost" onClick={() => openEdit(u)} aria-label="แก้ไข"><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                      <Button size="xs" variant="danger" onClick={() => setDelId(u.id)} aria-label="ลบ"><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-2.5 text-[13px] text-t3">
          <span>
            แสดง <b className="text-t2">{list.rows.length ? (list.page - 1) * list.pageSize + 1 : 0}-{Math.min(list.total, list.page * list.pageSize)}</b> จาก <b className="text-t2">{list.total}</b> คน
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5">
              <span>แถวต่อหน้า:</span>
              <select
                value={list.pageSize}
                onChange={(e) => nav({ pageSize: e.target.value })}
                className="rounded border border-border bg-bg2 px-1.5 py-1 text-[14px]"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <span className="flex gap-1.5">
              <ButtonLink href={hrefFor(base, { page: list.page - 1 })} size="xs" disabled={list.page <= 1}>‹</ButtonLink>
              <span className="self-center px-1">{list.page}/{list.pages}</span>
              <ButtonLink href={hrefFor(base, { page: list.page + 1 })} size="xs" disabled={list.page>= list.pages}>›</ButtonLink>
            </span>
          </div>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`แก้ไข: ${editing?.email ?? ""}`}>
        {editing && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[13px] font-bold text-t3">บทบาท (Role)</div>
              <div className="flex flex-wrap gap-1.5">
                {roles.map((r) => (
                  <button key={r.id} onClick={() => setRole(r.id)}
                    className={`rounded-pill border px-3 py-1.5 text-[14px] font-semibold transition ${role === r.id ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-t2"}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[13px] font-bold text-t3">Site Access (ว่าง = ทุก Site)</div>
              <div className="flex flex-wrap gap-1.5">
                {sites.map((s) => (
                  <button key={s.code} onClick={() => toggleSite(s.code)}
                    className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-1 text-[14px] font-semibold transition ${selectedSites.includes(s.code) ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-t2"}`}>
                    <Factory className="h-3.5 w-3.5" aria-hidden />{s.code}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditing(null)}>ยกเลิก</Button>
              <Button variant="primary" disabled={busy} onClick={onSave}>{busy ? "กำลังบันทึก…" : <><CircleCheck className="h-3.5 w-3.5" aria-hidden />บันทึก</>}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!delId} onClose={() => setDelId(null)} title={<span className="flex items-center gap-1.5"><TriangleAlert className="h-4 w-4" aria-hidden />ยืนยันการลบผู้ใช้</span>}>
        <div className="mb-3.5 text-[14px] text-t2">ลบผู้ใช้รายนี้ออกจากระบบ? (ไม่สามารถย้อนกลับได้)</div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDelId(null)}>ยกเลิก</Button>
          <Button variant="danger" disabled={busy} onClick={onDelete}>{busy ? "กำลังลบ…" : <><Trash2 className="h-3.5 w-3.5" aria-hidden />ยืนยันลบ</>}</Button>
        </div>
      </Modal>
    </div>
  );
}
