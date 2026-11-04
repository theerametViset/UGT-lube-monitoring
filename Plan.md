# Plan.md — Web App Implementation Plan

> **Project:** UGT Reliability Lubrication AI Platform v3
> **Source of truth:** `PRD.md` (+ `STACK_PHASE_PROMPTS.md`, `supabase/0001_schema.sql`, `supabase/0002_seed.sql`, `HTML/Lubrication_monitoring_final2 (1).html`)
> **วิธีใช้ไฟล์นี้:** เปลี่ยน `- [ ]` → `- [x]` เมื่อทำเสร็จ และอัปเดต **% ความคืบหน้า** ในแต่ละเฟสตามจำนวน task ที่ทำเสร็จ เพื่อติดตามความก้าวหน้าเทียบกับตารางเวลา (Schedule) ในส่วนท้าย

**Legend (ความซับซ้อน):** 🟢 S = 0.5 วัน · 🟡 M = 1 วัน · 🟠 L = 2 วัน · 🔴 XL = 3+ วัน
**สถานะ:** ⬜ ยังไม่เริ่ม · 🔄 กำลังทำ · ✅ เสร็จ · ⛔ บล็อก

---

## 0. สรุปการวิเคราะห์ PRD (Analysis)

### 0.1 สิ่งที่ต้องสร้าง (Scope)
- **16 โมดูล** บน Next.js 14 App Router + React + TypeScript + Tailwind + Supabase + Vercel
- แบ่งเป็น **P0 (8 โมดูล)** · **P1 (5 โมดูล)** · **P2 (3 โมดูล)**
- ระบบจริง (production-grade): มี Auth + RBAC, RLS, server-side scoring, multi-provider AI, export PDF/CSV/JSON

### 0.2 Complexity Assessment (ต่อโมดูล)
| โมดูล | Complexity | เหตุผล |
|---|---|---|
| Asset Database (CRUD) | 🟠 L | import/export JSON + validation + bulk ops |
| Drill-down Analysis | 🔴 XL | **6 tabs**, หลาย chart, RCA logic, AI slot — ซับซ้อนที่สุดของ P0 |
| Alarm Configuration | 🟠 L | scoring audit live + edit threshold ที่ recompute ทั้งระบบ |
| Dashboard | 🟠 L | 4 chart ไดนามิก + site scope + priority feed |
| Data Entry | 🟡 M | 2 ฟอร์ม (oil/vib) + validation |
| Watchlist / Standards | 🟡 M | filter + pagination + modal |
| Reports | 🔴 XL (P2) | jsPDF + html2canvas A4 + กราฟ + ลงนาม |
| Work Orders | 🟠 L | Kanban + List + filters + sort + modal |
| Budget Tracker | 🟠 L | 3 tabs + 2 chart + expense modal |
| AI Reliability Center | 🟠 L | Weibull + ranking + RUL logic |
| PM Compliance/Calendar/Setup/Alert | 🟡 M ตัว/โมดูล | |
| EAM Reporting | 🟠 L | 4 charts + drill-down + export |

### 0.3 Critical Path (เส้นทางที่กำหนดเวลารวม)
```
Setup Supabase + schema/seed
   → Design system components
      → Auth + RBAC middleware
         → Health Score engine (compute_health)
            → [P0 โมดูลทั้งหมดขนานกันได้หลังจากนี้]
               → P1 (ต้องมี assets + maintenance_records)
                  → P2 (AI ต้องมี provider + data; Budget อิสระ)
```
**คอขวด (Bottleneck):** หาก `compute_health` + design system ไม่เสร็จก่อน → ทุกโมดูลชะงัก → ต้องทำสองอย่างนี้ก่อนเป็นอันดับแรก

### 0.4 Risk Register (ความเสี่ยง)
| # | ความเสี่ยง | ผลกระทบ | มาตรการ |
|---|---|---|---|
| R1 | Health Score คำนวณไม่ตรงกันทุกหน้า | สูง — ทำลาย single source of truth | ใช้ `compute_health` DB function อย่างเดียว; เขียน test เทียบต้นแบบ |
| R2 | AI key รั่วไป client | สูง — ความปลอดภัย | เรียก Route Handler เท่านั้น, lint ตรวจ `NEXT_PUBLIC_*` |
| R3 | ข้อมูลตัวอย่าง 500 เครื่องทำให้หน้าช้า | กลาง | pagination 20/หน้า + index; chart `maintainAspectRatio:false` |
| R4 | RLS กำหนดผิด → ข้อมูลรั่วข้าม site | สูง | policy review + ทดสอบด้วย user 2 role/site |
| R5 | jsPDF/html2canvas เรนเดอร์กราฟไม่ได้บน server | กลาง | สร้าง PDF ฝั่ง client; หรือใช้ screenshot DOM |
| R6 | AI provider เปลี่ยน schema ตอบกลับ | กลาง | zod validate + fallback rule-based RCA |
| R7 | Parity สี/label/ตัวย่อผิด | ต่ำ | ดึงจาก `asset_types` seed (สี/abbr) อย่างเดียว |

### 0.5 สมมติฐานการวางแผน
- ใช้ workflow **Antigravity stacking + Kilo/GLM-5** → ความเร็วต่อ task สูง แต่ต้อง **ตรวจสอบ/review ทุก stack**
- ทำตามลำดับ P0 → P1 → P2 (แต่ละเฟส deploy ขึ้น Vercel ได้ = มี milestone ชัดเจน)
- มี account: GitHub, Vercel, Supabase, AI provider (อย่างน้อย GLM key)

---

## PHASE 0 — Foundation + Core CM (8 โมดูล)
> **เป้าหมายเฟส:** แอป deploy ได้ ล็อกอินได้ มีข้อมูลจริง คำนวณ Health Score ถูกต้อง ใช้งานโมดูลแกนกลาง 8 ตัวได้
> **ความคืบหน้า:** 31 / 52 tasks · **กำหนดเสร็จเป้าหมาย:** ตาม Schedule ส่วน 4

> ### ✅ Slice 1 delivered (Foundation + Dashboard vertical slice)
> Code-side foundation + Dashboard module เสร็จและผ่าน `typecheck` + `lint` + `build` (Next 14.2.35, BUILD_ID สร้างสำเร็จ).

> ### ✅ Slice 2 delivered (P0 ที่เหลือทั้ง 7 โมดูล)
> Watchlist, Drill-down (6 tabs), Data Entry, Asset DB (CRUD+import/export), Standards, Alarm Config, Reports(basic) ครบ + Modal/Toast + `audit.ts`/`rca.ts` + Server Actions. ผ่าน `typecheck`+`lint`+`build`; demo smoke 8/8 routes 200. Demo Mode รองรับทุกโมดูล (write = read-only toast).
> **คงเหลือ (ผู้ใช้):** P0-A (Supabase project + run SQL + โปรโมต admin + Vercel deploy), RLS re-test 2 role/site (P0-041), full Health parity re-test (P0-042 — ส่วนใหญ่ทำได้แล้วเพราะมี 4 หน้าแล้ว), deploy+smoke (P0-043).

### P0-A. Pre-flight Setup (พื้นฐานทั้งหมดต้องทำก่อน)
- [ ] **P0-001** 🟢 สร้าง GitHub repo (+ .gitignore: node_modules, .env, .next)
- [ ] **P0-002** 🟢 สร้าง Supabase project (region ใกล้ผู้ใช้), บันทึก URL/anon key/service role key
- [ ] **P0-003** 🟢 รัน `supabase/0001_schema.sql` บน SQL Editor → ตรวจทุกตาราง + function สร้างสำเร็จ
- [ ] **P0-004** 🟢 รัน `supabase/0002_seed.sql` → ตรวจ `seed_sample_assets(500)` + `recompute_all_health()` ทำงาน; ตรวจ assets 500 row + status กระจาย (Healthy/Warning/Critical)
- [ ] **P0-005** 🟢 ทดสอบ `compute_health()` กับ asset 1 ตัว — เทียบผลกับสูตรใน PRD §6 ต้องตรง (verify single source of truth) *(R1)*
- [ ] **P0-006** 🟢 สร้าง Vercel project, เชื่อม GitHub repo, ตั้ง env (PRD §3) แบบ Preview + Production
- [ ] **P0-007** 🟢 เตรียม AI provider key (GLM อย่างน้อย) เก็บใน Vercel env `AI_API_KEY` *(R2)*

### P0-B. Project Scaffold + Config
- [x] **P0-008** 🟡 Next.js scaffold (App Router, TS, Tailwind v3, ESLint) — ทำด้วย manual scaffold แทน create-next-app (repo ไม่ว่าง + Windows)
- [x] **P0-009** 🟢 ติดตั้ง deps: @supabase/ssr + supabase-js + chart.js + react-chartjs-2 + zod (jspdf/html2canvas/datalabels เก็บไว้ P2 — ยังไม่ใช้ใน slice นี้)
- [x] **P0-010** 🟡 Tailwind config + color/font tokens (PRD §9) — ใช้ Tailwind v3 + tailwind.config.ts; โหลด Inter/JetBrains Mono ผ่าน Google Fonts `<link>` (หลีกเลี่ยง next/font build-time fetch)
- [x] **P0-011** 🟡 Supabase clients: `lib/supabase/{server,browser,admin}.ts` (admin service-role, server-only) *(R2)*
- [x] **P0-012** 🟢 `.env.example` + `.env.local` (placeholder — ผู้ใช้ใส่ key จริง)
- [x] **P0-013** 🟢 Folder structure: `app/(auth)`, `app/(app)`, `app/auth/callback`, `components/{ui,layout,charts}`, `lib/{supabase,scoring,queries}`

### P0-C. Design System Components (parity §9) — *คอขวด: ต้องเสร็จก่อนโมดูล*
- [x] **P0-014** 🟡 `Sidebar` — 174px, ดำ, 2 sections, status footer, active state (usePathname) *(responsive collapse ≤760px ยังไม่ทำ — next slice)*
- [x] **P0-015** 🟡 `Topbar` — 50px frosted glass, title + active plant + notification bell + avatar + logout
- [x] **P0-016** 🟢 `Card` · `Badge`/`StatusBadge` · `Pill` · `Button` (ghost/primary/danger/ok, sm/xs)
- [x] **P0-017** 🟡 `KpiCard` + KPI grid (top accent bar by status)
- [x] **P0-018** 🟡 Fleet table + pagination (20/page) — inline ใน Dashboard แทน component แยก (extract ทีหลังได้)
- [x] **P0-019** 🟡 `Modal` + `Toast` (`components/ui/{Modal,Toast}.tsx` + `ToastProvider`) — ใช้ใน Asset DB/Standards/Data Entry/Alarm/Drill-down/Maintenance
- [x] **P0-020** 🟡 `NotificationBell` (bell dropdown — critical/warning assets)
- [x] **P0-021** 🟢 App shell `app/(app)/layout.tsx` (Sidebar + Topbar + content slot)

### P0-D. Auth + RBAC (§4)
- [x] **P0-022** 🟡 `/login` (email/password) + `/auth/callback` (code exchange) *(ใช้ email/password แทน magic link ใน slice นี้ — สอดคล้อง PRD §4 ที่จะทำ magic link ภายหลัง)*
- [x] **P0-023** 🟡 `middleware.ts` ตรวจ session → redirect `/login`; refresh token ผ่าน `getUser()`
- [x] **P0-024** 🟡 Route guard: middleware + layout redirect (per-role action guard ขยายใน slice ถัดไป)
- [ ] **P0-025** 🟢 โปรโมต user แรกเป็น `admin` + ทดสอบ RLS 2 role/site *(R4)* — **ผู้ใช้ทำหลัง signup + รัน SQL**
- [x] **P0-026** 🟢 Auth: ใช้ server `getCurrentProfile()` + `LogoutButton` (client context ยังไม่จำเป็นใน slice นี้)

### P0-E. Health Score Engine (§6) — *single source of truth*
- [x] **P0-027** 🟢 `lib/scoring/health.ts` — thin helpers อ่าน `assets.health/status` เท่านั้น (ไม่ recompute) *(R1 ปลอดภัย)*
- [x] **P0-028** 🟡 `lib/scoring/audit.ts` (deduction breakdown, display-only) + `lib/scoring/rca.ts` (failure-mode %) — ใช้ใน Drill-down > Health/Intelligence + Alarm Audit
- [ ] **P0-029** 🟢 ยืนยัน trigger recompute — **ผู้ใช้ verify ตอนรัน seed** (`recompute_all_health()` ท้าย 0002)

### P0-F. Shared Data Hooks / Queries
- [x] **P0-030** 🟡 `lib/queries/assets.ts` (dashboard aggregations + table) + `readings.ts` (latest oil/vib) — standards/alarm/maintenance queries ทำใน slice ถัดไป
- [x] **P0-031** 🟢 TypeScript types `lib/types.ts` (asset, reading, alarm_param, score_config, profile, site, asset_type)

### P0-G. Modules (§7.1–7.8) — *ทำได้พร้อมกันหลัง P0-C/E*
- [x] **P0-032** 🟠 **Dashboard** `/dashboard` (§7.1) — KPI×4 + site pills + Site Reliability chart + Priority Action Feed + Risk Concentration chart + fleet table + pagination + `/assets/[id]` placeholder
- [x] **P0-033** 🟡 **Watchlist** `/watchlist` (§7.2) — filter/search/status tabs/sort + health bar + pagination
- [x] **P0-034** 🔴 **Drill-down** `/assets/[id]` (§7.3) — 6 tabs (Wear, Oil, Vibration, Health, Maintenance, Intelligence/RCA) + Export JSON; AI panel เลื่อน P2
- [x] **P0-035** 🟡 **Data Entry** `/data-entry` (§7.4) — Oil/Vib form + validation (ISO, ≥1 field, ไม่ลบ) + Server Action `saveReading` (recompute via DB trigger)
- [x] **P0-036** 🟠 **Asset Database** `/assets` (§7.5) — table + Add/Edit/Delete + bulk + delete-all + import/export JSON (Server Actions)
- [x] **P0-037** 🟡 **Standards Library** `/standards` (§7.6) — grid + category filter + search + detail modal + add modal
- [x] **P0-038** 🟠 **Alarm Configuration** `/config/alarms` (§7.7) — live audit + score weighting + limits + penalties + Reset/Save → `recompute_all_health()` (admin RPC)
- [x] **P0-039** 🟡 **Reports (basic)** `/reports` (§7.8) — config + HTML preview + session history (PDF เต็ม P2)

### P0-H. P0 Verification + Deploy
- [x] **P0-040** 🟢 `tsc --noEmit` + `next lint` + `next build` ผ่าน (build-time; runtime console ต้องทดสอบตอนมี env จริง)
- [ ] **P0-041** 🟢 ตรวจ RLS 2 role/site *(R4)* — **ผู้ใช้ทำหลังมีข้อมูล**
- [ ] **P0-042** 🟢 ตรวจ Health Score parity หลายหน้า *(R1)* — **พร้อมตรวจ** (มี Dashboard/Watchlist/Drill-down/Alarm Audit 4 หน้าแล้ว ใช้ `assets.health` cache ตัวเดียว) → ผู้ใช้ verify บนข้อมูลจริง
- [ ] **P0-043** 🟢 Deploy Vercel Production + smoke test — **ผู้ใช้ทำ** (ตั้ง env บน Vercel)
- [ ] **P0-044** 🟢 ✅ **MILESTONE: P0 shippable (8 โมดูล)** — code-complete 8/8 โมดูลแล้ว (build+demo smoke ผ่าน); เหลือ P0-A setup + RLS/deploy ของผู้ใช้

> **Estimate P0:** ~38 task-days (S=0.5, M=1, L=2, XL=3) — เร่งได้ด้วย agentic stacking + review

---

## PHASE 1 — PM Operations (5 โมดูล)
> **เป้าหมายเฟส:** จัดการงาน PM/Work Order/Alert ครบ พร้อม seed generator parity ต้นแบบ
> **ความคืบหน้า:** 13 / 15 tasks · **กำหนดเสร็จเป้าหมาย:** ตาม Schedule ส่วน 4

> ### ✅ P1 code-complete (foundation + 5 โมดูล)
> SQL seed `0004_pm_seed.sql` (seed_pm_data) + demo generators (getDemoPMTasks/WorkOrders/Alerts) + types/queries/actions + on-read status + Sidebar enabled. 5 โมดูล: PM Compliance Hub, PM Calendar, Work Orders (Kanban+List), PM Master Setup, PM Alert Center. ผ่าน `typecheck`+`lint`+`build`; demo smoke 5/5 routes 200.
> **คงเหลือ (ผู้ใช้):** รัน `0004_pm_seed.sql` บน Supabase จริง + RLS re-test + deploy. (AI Executive Assistant = rule-based; LLM ใน P2)

### P1-A. Schema + Seed Generator (§5.6–5.8)
- [x] **P1-001** 🟢 ตาราง pm_tasks/work_orders/alerts + maintenance_records พร้อม (จาก 0001)
- [x] **P1-002** 🟡 Seed generator: `supabase/0004_pm_seed.sql` (seed_pm_data) + demo generators — พอร์ต genPMTasks/genWorkOrders/genAlerts
- [x] **P1-003** 🟡 คำนวณ overdue/status/escalation **on-read** (demo anchor 2026-07, real = today); alert escalation snapshot at gen
- [x] **P1-004** 🟢 Types + queries (pm/workorders/alerts)

### P1-B. Modules (§7.9–7.13)
- [x] **P1-005** 🟠 **PM Compliance Hub** `/pm/compliance` — KPI + trend(12mo, indicative) + Schedule by Plant + Overdue table + rule summary
- [x] **P1-006** 🟡 **PM Calendar** `/pm/calendar` — month nav + 7-col grid + event colors + day detail
- [x] **P1-007** 🟠 **Work Orders** `/work-orders` — summary×6 + Kanban (status cols, priority border, move buttons) + List (filters/sort/pagination) + create/edit/delete
- [x] **P1-008** 🟡 **PM Master Setup** `/pm/setup` — table + frequency/site/search filter + add/edit modal (LOTO/Permit) + delete
- [x] **P1-009** 🟠 **PM Alert Center** `/pm/alerts` — KPI + category pills + filters + select-all + bulk acknowledge + escalation dots + acknowledge/close

### P1-C. Wiring + Verification
- [x] **P1-010** 🟡 maintenance_records ↔ Drill-down Maintenance tab (ตั้งแต่ P0) + WO complete สามารถ log maintenance (ผ่าน updateWorkOrder)
- [x] **P1-011** 🟢 Sidebar เปิดเมนู PM 5 รายการ (EAM/AI/Budget ยัง disabled P2)
- [x] **P1-012** 🟢 RBAC: Server Actions ผ่าน user client → RLS บังคับ engineer/admin เขียน; viewer/manager read-only
- [ ] **P1-013** 🟢 ตรวจ overdue/escalation vs ต้นแบบ — **ผู้ใช้ verify บนข้อมูลจริง**
- [x] **P1-014** 🟢 `tsc` + `lint` + `build` ผ่าน
- [ ] **P1-015** 🟢 ✅ **MILESTONE: P1 shippable** — code-complete 5/5 โมดูล; เหลือผู้ใช้รัน seed + deploy

> **Estimate P1:** ~18 task-days

---

## PHASE 2 — Executive + AI (3 โมดูล + Reports เต็ม)
> **เป้าหมายเฟส:** AI Diagnostic ทำงาน, รายงานผู้บริหาร + EAM + AI Reliability + Budget ครบ, production hardening
> **ความคืบหน้า:** 0 / 26 tasks

### P2-A. AI Provider Abstraction (§8) — *ทำก่อน EAM/Intelligence*
- [ ] **P2-001** 🟡 `lib/ai/provider.ts` — type `AIProvider` + `DiagnoseResult` schema (zod)
- [ ] **P2-002** 🟡 `lib/ai/glm.ts` (default) + `openai.ts` + `anthropic.ts` — implement interface
- [ ] **P2-003** 🟠 Route Handler `POST /api/ai/diagnose` — server-only, service role, เลือก provider by env, parse+validate, fallback rule-based RCA *(R2,R6)*
- [ ] **P2-004** 🟢 ทดสอบ AI key ไม่ leak สู่ client (grep `NEXT_PUBLIC` ห้ามมี key)

### P2-B. Modules (§7.14–7.16 + Reports)
- [ ] **P2-005** 🟡 เสียบ AI ใน Drill-down > Intelligence (slot จาก P0-034)
- [ ] **P2-006** 🟠 **EAM/CMMS Reporting Center** `/eam` (§7.14) — drill-down + KPI + 4 charts + Executive AI Summary + CSV/JSON/Print-PDF
- [ ] **P2-007** 🟠 **AI Reliability Center** `/ai-reliability` (§7.15) — Weibull β≈2.2 + Top 15 ranking + RUL table + disclaimer
- [ ] **P2-008** 🟠 **Budget Tracker** `/budget` (§7.16) — Core Budget + Monthly Caps + Annual Planner + expense modal + charts
- [ ] **P2-009** 🔴 **Reports (full)** `/reports` (§7.8) — PDF generation (jsPDF+html2canvas A4, กราฟ, ลงนาม) + reports table + Storage + history

### P2-C. Cross-cutting NFR (§10)
- [ ] **P2-010** 🟡 Error boundary + loading skeletons + empty states ทุกหน้า
- [ ] **P2-011** 🟢 Accessibility pass: semantic HTML, aria-label, keyboard focus, status มี label คู่สี
- [ ] **P2-012** 🟢 Performance: ตรวจ Dashboard/Watchlist load < 2s @ 500 assets; index ครบ *(R3)*
- [ ] **P2-013** 🟡 Validation (zod) ทุกฟอร์ม/Server Action + toast + confirm modal ก่อน delete
- [ ] **P2-014** 🟢 i18n check: ไทยเป็นหลัก + label อังกฤษ parity

### P2-D. Final Verification + Release
- [ ] **P2-015** 🟢 ตรวจ parity ครบทั้ง 16 โมดูลเทียบต้นแบบ HTML (สี/label/ตัวย่อ/สูตร)
- [ ] **P2-016** 🟢 RLS re-test ทุก role × ทุก site *(R4)*
- [ ] **P2-017** 🟢 Health Score consistency re-test ทุกจุด *(R1)*
- [ ] **P2-018** 🟢 `tsc` + lint + build ผ่าน ไม่มี console error
- [ ] **P2-019** 🟢 Env แยก dev/prod บน Vercel + preview deploy ทุก PR
- [ ] **P2-020** 🟢 ทดสอบ export: PDF (Reports), CSV/JSON (EAM/Database), JSON (import/export asset)
- [ ] **P2-021** 🟢 ลบ seed sample หรือแยก env เมื่อ production (optional)
- [ ] **P2-022** 🟢 เอกสาร: README (setup/env/migrate/seed/deploy) — optional
- [ ] **P2-023** 🟢 ✅ **MILESTONE: P2 shippable — v1.0 release ครบ 16 โมดูล**

> **Estimate P2:** ~26 task-days

---

## 3.9 Post-v1 additions (หลัง P2)
- [x] **PV-001** Local Store: บันทึกผลแล็บ + ไฟล์แนบลง `.local-data/` ใน Demo Mode + export SQL ขึ้น Supabase
- [x] **PV-002** นำเข้า Excel: จับคู่ TAG แบบปลอดภัย (ไม่สร้างเครื่องอัตโนมัติ) + batch ตรวจทานรายแถว + อ่านวันที่/งวดถูกต้อง
- [x] **PV-003** ~~Oil Sampling Cycle `/sampling` (PRD §7.17)~~ — ถอดออก 2026-10-28
- [x] **PV-004** ISO 4406 ไม่อ่านวันที่เป็นรหัส ISO (`isoCodeIn`)
- [x] **PV-005** Accessibility: contrast tokens, h1/h2, nav landmark, touch target, reduced motion, Modal focus trap, label ฟอร์ม login/signup
- [ ] **PV-006** นำเข้าผล Vibration จาก Excel
- [x] **PV-007** จำกัด Local Store ให้เข้าได้เฉพาะเครื่องนี้ (ไม่มี login) — `npm run dev` และ `npm start` ฟังเฉพาะ `127.0.0.1` (2026-11-03)
- [ ] **PV-008** ตั้งค่า Supabase จริง (รัน 0001→0033 — `0032` ใส่โรงงาน/เครื่องจริงแล้ว, ปิด signups, ตั้ง admin) + deploy Vercel — ⛔ ทำ PV-016 ก่อน
- [x] **PV-009** ถอด PM Management Center ทั้งเมนู (PM ×4, Work Orders, EAM, AI Reliability, AI Chat, Budget) — เก็บตารางในฐานข้อมูลไว้ + `0029` ถอนสิทธิ์; Data Entry แสดง "ค่าเกินเกณฑ์ ควรเปิดงานซ่อม" (spec `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`)
- [x] **PV-010** รายการเครื่องจักรตาม `Final equipment in program.xlsx` (569 เครื่อง) ใน `lib/demo-data.ts` + `supabase/0032_real_equipment.sql` (สร้างด้วย `scripts/gen-real-equipment-sql.py`: เพิ่มโรงงาน CPL/TSL/UFA/UNT/UTCA + ประเภท, ใส่เฉพาะเครื่องที่ยังไม่มี — ไม่แก้เครื่องเดิม, ลบโรงงาน/ประเภทต้นแบบที่ไม่มีใครใช้) — 2026-11-03
- [x] **PV-011** Asset DB นำเข้า `.xlsx` (หัวคอลัมน์เดียวกับไฟล์ส่งออก) + template `UGT-Equipment-Import-Template.xlsx`; VG/ปริมาณ/รอบ = 0 คงไว้ (ไม่กลายเป็น 46/20/6), ข้ามแถวที่โรงงาน/ประเภทไม่มีในระบบ, รหัสซ้ำใช้แถวล่างสุด
- [x] **PV-012** หน้าคลังมาตรฐาน: ตาราง (โซน ISO 20816-3, รหัส ISO 4406, ช่วง VG), ส่วน "ใช้ในงาน UGT", การ์ดข้อมูลเอกสาร; ตัดกล่องเกณฑ์ UGT ที่ซ้ำ
- [x] **PV-013** นำเข้าผลแล็บแบบ Batch บันทึกทั้งไฟล์ในคำขอเดียว (`saveOilBatch`) + ถามยืนยันก่อนทับผลที่มีอยู่แล้ว
- [x] **PV-014** แก้ตาม audit 2026-11-03: งวดอนาคตถูกปฏิเสธ, วันที่ค่าเริ่มต้นเป็นเวลาไทย, ค้นหาด้วย ( ) , ไม่พัง, ตัวเลขแล็บ "0,050"/"1.5E-02", รายงาน/อีเมลใช้เกณฑ์ 40/80, Alarm Config ใช้เกณฑ์เฉพาะเครื่อง, ตรวจช่วงค่าหักคะแนนฝั่งเซิร์ฟเวอร์, AI ไม่ถูกเรียกใน Demo บน production, export SQL ไม่เขียนค่าว่างทับ, ลบโค้ดที่ไม่ใช้
- [x] **PV-015** `0033_latest_oil_view.sql` — Asset DB อ่านเฉพาะผลน้ำมันล่าสุดของแต่ละเครื่อง (ไม่ช้าลงตามจำนวนงวด)
- [x] **PV-017** ลบ migration ของโมดูลที่ถอดแล้ว (0004–0006, 0018, 0019) + ตัดเครื่องตัวอย่าง 500 เครื่องออกจาก 0002 + แก้ 0001 (`check_function_bodies`) และ 0014 (uuid) — migration ทั้ง 28 ไฟล์รันผ่านบน Postgres ใหม่ (ทดสอบบน PGlite) — 2026-11-03
- [x] **PV-018** ปรับ UI — 2026-11-04: ชื่อแอป "UGT RELIABILITY · Lube Monitoring" (Sidebar, title, Login, รายงาน, อีเมล); แถบหัวสีดำเดียวกับ Sidebar (หน้าต่างค้นหา/แจ้งเตือนยังตามธีม — `.follow-theme`); ปุ่มธีม/ผู้ใช้/ออกจากระบบย้ายไปการ์ดท้าย Sidebar; กล่องแจ้งเตือนกว้างขึ้น + ยอดรวมวิกฤต/เฝ้าระวัง + ลิงก์ไป Dashboard ที่กรองสถานะ; ตัวเลขบนเมนู Dashboard (แดง = วิกฤต, เหลือง = เฝ้าระวังเมื่อไม่มีวิกฤต); คลังมาตรฐานมีแท็บ ทั้งหมด / Lubrication / Vibration / อื่นๆ
- [ ] **PV-016** ความปลอดภัยที่ค้างจาก audit — ต้องทำก่อนเชื่อม Supabase จริง:
  - [ ] `can_access_site` คืน true ให้ผู้ที่ไม่ได้ login (anon อ่าน assets/readings/ไฟล์แล็บได้) → migration ใหม่ให้ต้องมี `auth.uid()`
  - [ ] `lib/env.ts` เปิด Demo Mode เองบน production เมื่อไม่มี env Supabase (ไม่ต้อง login)
  - [ ] policy `audit_insert` (0012) ให้ผู้ใช้ทุกคนเขียนประวัติปลอมได้
  - [ ] `/api/ai/diagnose`, `/api/ai/rca`, `/api/ai/exec-summary`, `/api/ai/standard`, `/api/search`, `/api/compare` ไม่ตรวจสิทธิ์ดูโมดูล
  - [ ] เทสต์ที่ล้มเมื่อ action เขียนข้อมูลตัวใดไม่เรียก `requirePermission`

## 4. Schedule / Timeline (เทียบมาตรฐาน — ปรับตามจังหวะจริง)

| ระยะ | งานหลัก | เป้าหมายสัปดาห์ |
|---|---|---|
| **Wk 1** | P0-A..C (Setup + Scaffold + Design System) + P0-D (Auth) | พื้นฐาน + ล็อกอินได้ |
| **Wk 2** | P0-E..F (Scoring + Queries) + เริ่ม Dashboard/Watchlist | Health Score ทำงาน |
| **Wk 3** | Drill-down + Data Entry + Asset DB | โมดูลหลักครึ่งหนึ่ง |
| **Wk 4** | Standards + Alarm Config + Reports(basic) + P0 verify/deploy | ✅ **M0: P0 shippable** |
| **Wk 5** | P1 seed generator + PM Compliance + PM Calendar | เริ่ม PM ops |
| **Wk 6** | Work Orders + PM Master + Alert Center + P1 verify/deploy | ✅ **M1: P1 shippable** |
| **Wk 7** | AI provider + เสียบ Intelligence + EAM Reporting | AI ทำงาน |
| **Wk 8** | AI Reliability + Budget + Reports(full PDF) | โมดูล executive |
| **Wk 9** | NFR hardening + parity/RLS/scoring re-test + release | ✅ **M2: v1.0 release** |

> *หากใช้ agentic stacking เร่งรัด — Schedule อาจสั้นลง ~30–40%; แต่คงไว้ซึ่งช่วง review หลังแต่ละเฟสเสมอ*

### Milestones (จุดตรวจรับมอบ)
- **M0 (หลัง Wk 4):** P0 deploy → 8 โมดูลใช้ได้, Health Score ถูกต้อง
- **M1 (หลัง Wk 6):** P1 deploy → PM/WO/Alert ครบ
- **M2 (หลัง Wk 9):** v1.0 → ครบ 16 โมดูล + AI + Reports + hardening

---

## 5. Master Definition of Done Checklist (PRD §11) — ใช้กับทุกโมดูล
- [ ] Route สร้าง + RBAC guard ครบตามบทบาท
- [ ] parity ฟีเจอร์ + สูตรคำนวณกับต้นแบบ HTML
- [ ] ดึง/เขียน Supabase ผ่าน RLS (ไม่ mock)
- [ ] Validation + toast + confirm modal ครบ
- [ ] Responsive + parity ดีไซน์ (≤1100px / ≤760px)
- [ ] Export ที่เกี่ยวข้องทำงาน
- [ ] ไม่มี console error; `tsc` ผ่าน

---

## 6. การติดตามความก้าวหน้า (Tracking)
1. อัปเดต `- [x]` ทุกครั้งที่ทำ task เสร็จ
2. อัปเดต **"ความคืบหน้า: X / N tasks"** ด้านบนแต่ละเฟส
3. บล็อก task → ทำเครื่องหมาย ⛔ + บันทึกเหตุใต้ task นั้น
4. สิ้นสัปดาห์ → เทียบจริงกับตาราง Schedule; หากช้า → ทบทวน risk + deprioritize Non-Goal
5. สิ้นเฟส → รัน Master DoD checklist + deploy milestone

---

## 7. หมายเหตุ parity สำคัญ (ห้ามพลาด — PRD §13)
- **Single scoring formula** (`healthPenalty` + oil/vib weighting) ทุกหน้า — เช็คก่อนปิดทุกโมดูล *(R1)*
- Health ทุกที่ (Dashboard/Watchlist/Drill-down/Alarm Audit/AI Reliability) ต้องตรงกัน
- Save alarm/threshold → recompute health ทุก asset (parity ปุ่ม "บันทึก")
- AI ต้องผ่าน Route Handler เท่านั้น — ห้ามเรียก frontend ตรงๆ เหมือนต้นแบบ *(R2)*
- สี/label/ตัวย่อประเภทเครื่องจักร + site codes ต้องตรงต้นแบบ (ดึงจาก seed) *(R7)*
