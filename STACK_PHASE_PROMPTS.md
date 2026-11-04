# Stack Pack — Phase Prompts (copy-paste ready)

> Workflow: **Antigravity stacking with Kilo Code + GLM-5**
> Stack แต่ละชั้นคือ context ที่ส่งเข้า agent ตามลำดับ
>
> ไฟล์ที่เกี่ยวข้อง (วางไว้ใน workspace เดียวกับ agent):
> - `PRD.md` — master spec (domain + สถาปัตยกรรม + data model + สูตร Health Score)
> - `supabase/0001_schema.sql` — schema + RLS + `compute_health` + triggers
> - `supabase/0002_seed.sql` — reference data + standards + `seed_sample_assets(500)`
> - `HTML/Lubrication_monitoring_final2 (1).html` — ต้นแบบ UI/UX และสูตรคำนวณ

---

## 🔵 STACK 1 — Master context (ส่งครั้งแรกทุกครั้ง)

```
อ่านและจดจำ PRD.md (ทั้งไฟล์) และไฟล์ต้นแบบ HTML/Lubrication_monitoring_final2 (1).html เป็น source of truth สำหรับฟีเจอร์/สูตร/ดีไซน์
โครงสร้างข้อมูล + ความปลอดภัย + สูตร Health Score อยู่ใน supabase/0001_schema.sql และ supabase/0002_seed.sql
กฎเหล็ก: Health Score ใช้สูตรเดียว (compute_health) ทุกหน้า — ห้าม hardcode ห้ามคำนวณคนละแบบ
Tech stack: Next.js 14 App Router + React + TypeScript + Tailwind + Supabase + Vercel; AI ผ่าน Route Handler เท่านั้น
เมื่อพร้อมให้รอรับ phase prompt ถัดไป (P0 -> P1 -> P2) — อย่าเริ่ม implement จนกว่าจะได้รับ phase prompt
```

---

## 🟦 STACK 2A — Phase P0 (Foundation + Core CM)

```
Implement Phase P0 ของ UGT Reliability Lubrication AI Platform ตาม PRD.md (section 7.1–7.8):

1) Scaffold Next.js 14 App Router + TypeScript + Tailwind + @supabase/ssr + chart.js + react-chartjs-2 + chartjs-plugin-datalabels + jsPDF + html2canvas + zod
2) Database: รัน supabase/0001_schema.sql แล้ว supabase/0002_seed.sql; ยืนยันว่า seed_sample_assets(500) ทำงาน และ compute_health/trigger recompute ถูกต้อง
3) Design system (parity ต้นแบบ): สร้าง React components — Sidebar (2 sections), Topbar (frosted glass + notification bell + active plant), KpiGrid/KpiCard, Card, Badge (crit/warn/ok), Pills, Button (p/g/ai/ok/del, sm/xs), DataTable+pagination, Modal, Toast, Notification panel; color tokens + Tailwind config ตาม PRD section 9
4) Auth + RBAC: middleware ตรวจ session (Supabase SSR), /login, route guard ตาม role; profiles + role helper จาก schema
5) Health Score service (server): ใช้ compute_health ฝั่ง DB; สร้าง helper อ่าน assets.health/status อย่างเดียว — ไม่คำนวณซ้ำฝั่ง client
6) Modules ให้ครบ parity ต้นแบบ:
   - Dashboard (/dashboard): KPI x4, site pills, Site Reliability chart (stacked bar + avg line), Priority Action Feed top10, Risk Concentration by Equipment Type, fleet table (search/filter/pagination)
   - Watchlist (/watchlist): filter site/search/status tab/sort, row + health bar, pagination
   - Drill-down (/assets/[id]): header + 6 tabs (Wear, Oil, Vibration, Health, Maintenance, Intelligence) — Intelligence tab ใช้ RCA chart ฝั่ง client + ที่ว่างสำหรับ AI (P2)
   - Data Entry (/data-entry): เลือกเครื่อง, Oil/Vib form, validation (ISO XX/XX/XX, ค่าลบ, ≥1 field), upsert reading -> recompute -> toast
   - Asset Database (/assets): CRUD + Add/Edit modals + validation, import/export JSON, delete all, bulk delete, pagination
   - Standards Library (/standards): grid + category filter + search, detail modal, add modal
   - Alarm Configuration (/config/alarms): Health Score Audit (per-asset deduction breakdown), Oil/Vib weight editor (auto-balance), limits forms, deduction reference table (edit on blur), Reset + Save (recompute all)
   - Reports (/reports): config (site/period/type/sections/signers) + basic preview (PDF เต็มทำใน P2)
7) ทุก read/write ผ่าน Supabase client ภายใต้ RLS — ห้าม mock; ใช้ Server Components/Actions สำหรับดึงข้อมูล
8) Responsive parity (grids degrade ≤1100px และ ≤760px)

ส่งมอบ: รายการไฟล์ที่สร้าง, คำสั่ง setup/migrate/seed, ตัวอย่าง .env, และยืนยัน deploy ขึ้น Vercel ได้
```

---

## 🟨 STACK 2B — Phase P1 (PM Operations)

```
Implement Phase P1 ต่อจาก P0 ตาม PRD.md (section 7.9–7.13 + 5.6–5.8):

1) ตาราง pm_tasks / work_orders / alerts / maintenance_records พร้อมใช้ (จาก 0001_schema.sql); สร้าง seed generator ฝั่ง server พอร์ต logic ต้นแบบ (genPMTasks/genWorkOrders/genAlerts): ~125 PM tasks (1 ต่อ 4 assets), WOs จาก subset PM + CM/EM จาก critical assets, alerts จาก overdue PM + critical equipment + upcoming PM; คำนวณ overdueDays/status/escalationLevel
2) PM Compliance Hub (/pm/compliance): site pills + KPI (compliance%, overdue, due soon, scheduled) + Compliance Trend 12mo (line + target 95%) + Schedule Achievement by Plant (bar) + Overdue PM table + AI/rule summary
3) PM Calendar (/pm/calendar): month nav, 7-col grid, event colors (ปกติ/ใกล้ครบ/เกินกำหนด), click day -> รายการ PM วันนั้น
4) Work Orders (/work-orders): summary cards x5 + Kanban (status columns, priority border colors, overdue highlight, quick-action) + List view (sortable WO ID/asset/prio/due/cost) + filters (search/type/priority/status/sort + clear) + create/edit/delete modal
5) PM Master Setup (/pm/setup): table + frequency filter + search + pagination + add/edit modal (LOTO/Permit required)
6) PM Alert Center (/pm/alerts): KPI + category pills + filters (search/category/status group/sort) + select all + bulk acknowledge + ISA-18.2 workflow chips + escalation dots (0-4)
7) เชื่อม maintenance_records กับ Drill-down > Maintenance tab และเชื่อมโยงกับ Work Orders

ทุกข้อมูลผ่าน RLS; overdue/escalation คำนวณฝั่ง server (cron/trigger หรือ on-read); deploy ขึ้น Vercel ได้
ส่งมอบ: รายการไฟล์ + ยืนยัน parity ฟีเจอร์กับต้นแบบ
```

---

## 🟪 STACK 2C — Phase P2 (Executive + AI)

```
Implement Phase P2 ต่อจาก P1 ตาม PRD.md (section 7.14–7.16, 8, 5.10):

1) AI provider abstraction: lib/ai/provider.ts (type AIProvider) + lib/ai/{glm,openai,anthropic}.ts; Route Handler POST /api/ai/diagnose (server-only, รับ {assetId}, ดึงข้อมูลด้วย service role, เลือก provider ตาม AI_PROVIDER env, key ใน AI_API_KEY — ห้าม expose); output schema ตาม PRD section 8 (summary/primaryAnomaly/confidencePct/oilAnalysis/vibrationAnalysis/rootCauseHypothesis/actionPlan{immediate,shortTerm,longTerm})
2) เสียบ AI ใน: Drill-down > Intelligence (พื้นที่ที่เตรียมไว้ใน P0), PM Compliance Hub > AI Executive Assistant, EAM > Executive AI Summary
3) EAM/CMMS Reporting Center (/eam): drill-down by plant + KPI grid + charts (Cost by Work Type, PM Compliance by Plant, WO Status Distribution, Top Cost Drivers) + Executive AI Summary + export CSV/JSON + Print/PDF
4) AI Reliability Center (/ai-reliability): KPI + Failure Probability Distribution (Weibull β≈2.2, 90d) + Top 15 Critical Equipment Ranking (Health × Degradation Rate) + RUL table (rank/asset/site/health/failure prob/est RUL/risk score + search) + disclaimer
5) Budget Tracker (/budget) 3 tabs: Core Budget (+expense, KPI cap/actual/variance, Actual vs Plan chart monthly/cumulative, donut by machine type, expense log) + Monthly Caps (12 months, bulk apply, per-month cap/actual) + Annual Planner (project table + add form name/month/budget/equipment link/status/notes); expense modal (date/desc/amount/machine type/category parts|repair/project link/PR/PO/WO/vendor)
6) Reports ขยายเต็ม: PDF generation (jsPDF+html2canvas, A4, กราฟ + ช่องลงนาม prepared/reviewed/approved), เก็บใน reports table + Supabase Storage, report history
7) Production hardening: error boundaries, loading/empty states, ทุก module ผ่าน Definition of Done (PRD section 11)

ทุกข้อมูลผ่าน RLS; deploy ขึ้น Vercel ได้; ส่งมอบ: รายการไฟล์ + ยืนยัน parity ครบทั้ง 16 โมดูล + ตัวอย่าง .env (incl. AI_PROVIDER/AI_MODEL)
```

---

## 🧩 แยกเป็น module-level (ถ้าเฟสใหญ่เกินไป)
ใช้ร่วมกับ Stack 1 (master context) แล้วส่งเฉพาะ module ที่ต้องการ ทีละตัว โดยอ้าง section ใน PRD.md:
- `Implement module <ชื่อ> ตาม PRD.md section <X.Y> ให้ parity ต้นแบบ HTML ส่วน pg-<id>; ผ่าน RLS; deploy ได้`
