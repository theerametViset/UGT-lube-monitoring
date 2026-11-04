// Asset master-data checks for the Asset DB "ข้อมูลที่ควรตรวจ" panel. A wrong
// VG grade makes every viscosity score of that machine wrong (e.g. 2030-B01-1
// was VG 2 but its oil measured 218 cSt), so these surface data worth a look.
import { ISO_VG, suspectVgGrade } from "@/lib/viscosity-limits";

export const ISSUES = {
  vg_mismatch: { label: "VG ไม่ตรงกับความหนืดที่วัดได้", hint: "ความหนืดที่วัดได้ห่างจากเกรดที่ตั้งไว้ 2 เท่าขึ้นไป — เกรดน่าจะตั้งผิด" },
  vg_2: { label: "VG 2", hint: "น้ำมันใสมาก พบน้อยในเครื่องจักรโรงงาน — ตรวจว่าเป็นจารบี NLGI 2 หรือกรอกผิด" },
  vg_missing: { label: "ไม่ระบุ VG", hint: "ไม่มีเกรด VG จึงเทียบความหนืดตามเกรดไม่ได้ — ระบบใช้เกณฑ์ความหนืดกลางในหน้าตั้งค่าแจ้งเตือน (เริ่มต้น > 242 / > 264 cSt) · น้ำมันเกรด SAE (เช่น 15W-40) ไม่มี VG ให้ระบุเกรดไว้ในช่องยี่ห้อ" },
  vg_nonstandard: { label: "VG ไม่ใช่เกรดมาตรฐาน ISO", hint: "เช่น 329 — ตรวจกับป้ายเครื่องหรือตารางหล่อลื่น" },
  oil_info: { label: "ข้อมูลน้ำมันไม่ครบ", hint: "ไม่ระบุยี่ห้อน้ำมัน ปริมาณน้ำมัน หรือรอบเปลี่ยนน้ำมัน" },
  odd_id: { label: "รหัสมีอักขระพิเศษ", hint: "มีช่องว่าง * หรือวงเล็บ — จับคู่ TAG ผลแล็บได้ยาก (ไม่นับรหัสแยกจุดหล่อลื่น เช่น 31-A02 (Gear Box))" },
  no_readings: { label: "ยังไม่มีผลแล็บ", hint: "ยังไม่เคยบันทึกผลวิเคราะห์น้ำมัน" },
} as const;

export type IssueKey = keyof typeof ISSUES;

export function isIssueKey(s: string | undefined): s is IssueKey {
  return !!s && s in ISSUES;
}

export function assetIssues(
  a: { id: string; vg_grade: number | null; oil_brand: string | null; oil_qty_l: number | null; oil_change_months: number | null },
  latestOil: { visc: number | null } | null,
): IssueKey[] {
  const out: IssueKey[] = [];
  const vg = a.vg_grade;
  if (suspectVgGrade(latestOil?.visc, vg)) out.push("vg_mismatch");
  if (vg === 2) out.push("vg_2");
  else if (!vg) out.push("vg_missing");
  else if (!(ISO_VG as readonly number[]).includes(vg)) out.push("vg_nonstandard");
  if (!a.oil_brand?.trim() || !a.oil_qty_l || !a.oil_change_months) out.push("oil_info");
  // "31-A02 (Gear Box)": one lubrication point of a machine, named on purpose — not a typo
  const point = /^[^\s*()]+ \([^()*]+\)$/.test(a.id);
  if (!point && /[\s*()]/.test(a.id)) out.push("odd_id");
  if (!latestOil) out.push("no_readings");
  return out;
}
