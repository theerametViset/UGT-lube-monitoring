# PRD — UGT Reliability Lube Monitoring v3

> **Ready-to-copy snippet สำหรับ Antigravity stacking with Kilo Code + GLM-5**
> วางเอกสารนี้ทั้งหมดเป็น master spec / context รอบที่ 1 (PRD), แล้วใช้ Phase Prompt (P0 → P1 → P2) ในส่วนท้ายเป็น context รอบถัดไปเพื่อ implement เป็นลำดับ

| ฟิลด์ | ค่า |
|---|---|
| **ชื่อโปรเจกต์** | UGT Reliability Lube Monitoring (เวอร์ชันสร้างจริง v3; เดิมชื่อ Lubrication AI Platform — เปลี่ยน 2026-11-04) |
| **ต้นแบบอ้างอิง (Reference UI/UX)** | `HTML/Lubrication_monitoring_final2 (1).html` — สร้าง parity ฟีเจอร์และสูตรคำนวณเท่าต้นแบบ |
| **Stack** | Next.js 14+ (App Router) · React 18 · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + RLS + Storage) · Vercel (Hosting) |
| **AI** | Multi-provider pluggable (GLM-5 / OpenAI / Anthropic) เรียกผ่าน Route Handler ฝั่ง server เท่านั้น |
| **ภาษา UI** | ไทย/อังกฤษ (bilingual) — เหมือนต้นแบบ |
| **ผู้ใช้เป้าหมาย** | Reliability Engineer, Maintenance Manager, Planner, Technician, Plant Manager |
| **เฟสวางจำหน่าย** | P0 (Foundation + Core CM) · P1 (PM Operations) · P2 (Executive + AI) |

---

## วิธีใช้ PRD นี้ใน Workflow Antigravity stacking + Kilo/GLM-5

1. **Stack 1 (PRD):** วางเอกสารนี้ทั้งไฟล์เป็น system/master context เพื่อให้ agent เข้าใจ domain + สถาปัตยกรรม + data model ทั้งหมด
2. **Stack 2 (Phase Prompt):** คัดลอกเฉพาะบล็อก **"🧱 Phase Implementation Prompts"** ของแต่ละเฟส (P0 → P1 → P2) มาเป็น user prompt รอบถัดไป — แต่ละเฟสส่งมอบ shippable build ที่ deploy ขึ้น Vercel ได้
3. **Stack 3 (Module Prompt):** หากเฟสใดใหญ่เกินไป แยกตาม module spec ในส่วน "Feature Specifications"
4. **กฎเหล็ก:** ทุก Health Score, Status, Penalty ต้องใช้สูตรเดียวกัน (ด้านล่าง) — ห้าม hardcode ห้ามคำนวณคนละแบบในแต่ละหน้า เพราะต้นแบบออกแบบให้มี single source of truth

---

## 1. ภาพรวมผลิตภัณฑ์ (Executive Summary)

แพลตฟอร์ม Condition Monitoring สำหรับโรงงานอุตสาหกรรม ผสาน **Oil Analysis + Vibration Analysis** เพื่อคำนวณ Health Score ของเครื่องจักรแบบ real-time เน้น **Lubrication Monitoring** อย่างเดียว: ติดตามความเสี่ยงระดับกองเครื่องจักร → วิเคราะห์เชิงลึกรายเครื่อง → ป้อนข้อมูลแล็บ → รอบเก็บตัวอย่างน้ำมัน → รายงานผู้บริหาร และ AI Diagnostic (โมดูล PM / Work Order / งบประมาณ / EAM / AI Reliability ถอดออกเมื่อ 2026-10-28 — งานซ่อมเปิดในระบบอื่น)

จุดเด่นเชิงโดเมน:
- **Health Score algorithm โปร่งใส** — คำนวณจากขีดจำกัด (threshold) ที่ผู้ใช้กำหนดได้ มี audit log แสดงการหักคะแนนทุกข้อ
- **Single scoring formula** — ทุกหน้า (Dashboard, Watchlist, Drill-down, Alarm Audit) ใช้สูตรเดียวกัน
- **มาตรฐานวิศวกรรมฝัง** — คลัง ISO/ASTM/SAE/API เชื่อมโยงกับเกณฑ์การตัดคะแนน

---

## 2. เป้าหมายและขอบเขต (Goals & Non-Goals)

### ✅ Goals
- สร้างแอปจริงบน Next.js + Supabase ที่มีฟีเจอร์ Lubrication Monitoring ตามต้นแบบ HTML (โมดูล 1–8 + §7.17)
- ข้อมูลถาวรใน Supabase Postgres พร้อม Row Level Security แยกตาม Site/บทบาท
- Health Score คำนวณฝั่ง server (DB function / API) เพื่อ consistency ทั้งระบบ
- Multi-tenant-ready (หลายโรงงาน/Plant) และ RBAC ครบ
- Deploy บน Vercel, รองรับ PDF/CSV/JSON export

### ⛔ Non-Goals (ออกจาก v1)
- ไม่ต้องเชื่อมต่อ IoT sensor / SCADA แบบ realtime stream (ข้อมูลเข้าทาง Manual Data Entry + import เหมือนต้นแบบ)
- ไม่ต้องเขียน ML model ฝังตัวเอง — AI Diagnostic ใช้ LLM provider ภายนอก
- ไม่ต้องมี mobile native app (responsive web พอ)
- ไม่จัดการงาน PM / Work Order / งบประมาณ ในระบบนี้ (ถอดออก 2026-10-28)

---

## 3. Tech Stack & สถาปัตยกรรม

```
┌──────────────────────────────────────────────────────────┐
│  Vercel (Edge / Node.js runtime)                          │
│  Next.js 14 App Router (RSC + Client Components)           │
│  ├─ /app/(auth)        → login, signup (Supabase Auth)     │
│  ├─ /app/(dashboard)   → 16 modules (route groups)         │
│  ├─ /app/api/*         → Route Handlers (server-only)      │
│  │   ├─ /api/ai/diagnose   → AI proxy (ซ่อน API key)       │
│  │   ├─ /api/reports/*     → PDF/CSV generation            │
│  │   └─ /api/health-score  → scoring service               │
│  └─ Server Actions / RSC  → ดึงข้อมูลผ่าน Supabase SSR client │
├──────────────────────────────────────────────────────────┤
│  Supabase                                                  │
│  ├─ Postgres (tables + RLS + DB functions/health_score)    │
│  ├─ Auth (email + magic link + RBAC via profiles.role)     │
│  ├─ Realtime (optional: แจ้งเตือน alerts แบบ push)          │
│  └─ Storage (PDF reports, imported JSON)                   │
├──────────────────────────────────────────────────────────┤
│  Libraries                                                 │
│  Tailwind CSS · Chart.js + react-chartjs-2               │
│  (เท่าต้นแบบ) · @supabase/ssr · jsPDF + html2canvas · zod  │
└──────────────────────────────────────────────────────────┘
```

### การจัดการ environment variables (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only
AI_PROVIDER=glm                    # glm | openai | anthropic
AI_API_KEY=                        # server-only, ไม่ expose
AI_MODEL=glm-5.2                   # หรือ gpt-4o / claude-sonnet
NEXT_PUBLIC_APP_URL=
```

---

## 4. Authentication & Role-Based Access Control (RBAC)

### บทบาท (roles)
| Role | สิทธิ์ |
|---|---|
| `admin` | ทุกฟีเจอร์ + จัดการผู้ใช้ + ลบข้อมูลทั้งหมด + import/export |
| `engineer` | ป้อนข้อมูลแล็บ, แก้ไขเครื่องจักร, ตั้งค่า alarm, สร้าง WO/PM, ดูรายงาน |
| `manager` | ดูทุกหน้า + export รายงาน + จัดการงบประมาณ (แก้ไขจำกัด — ไม่ลบ asset) |
| `viewer` | ดู Dashboard/Watchlist/รายงานแบบ read-only |

### ตาราง `profiles`
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'viewer'
    check (role in ('admin','engineer','manager','viewer')),
  site_access text[] default '{}',   -- plant codes ที่เข้าได้, '{}' = ทุก site
  created_at timestamptz default now()
);
```

### RLS policy pattern
- ทุกตารางที่มี `site` column ต้องมี policy: user ที่ไม่ใช่ admin เห็นเฉพาะ row ที่ `site = any(current_user_site_access)` หรือ `site_access = '{}'`
- `admin` เห็นทุก row
- `viewer` = SELECT เท่านั้น
- Middleware ตรวจ session + redirect `/login` เมื่อไม่มี session

---

## 5. Data Model (Supabase / Postgres Schema)

> IDs ใช้รูปแบบตามต้นแบบ (`RE-1001`, `WO-50000`, `PM-001`, `AL-1000`, `EXP-...`, `AP-2026-001`) เก็บเป็น `text` primary key เพื่อ parity กับ UI/แล็บเดิม และสร้างทาง application logic

### 5.1 Sites & Reference Data
```sql
-- Plant codes (ต้นแบบ): UT, PCD, SA, TSL, NY1
create table sites (
  code text primary key,            -- 'NY1'
  name text not null,               -- display name
  sort_order int default 0
);

-- ประเภทเครื่องจักร + abbreviation + สี (parity ต้นแบบ)
create table asset_types (
  name text primary key,            -- 'Reciprocating Pump'
  abbr text,                        -- 'RE'
  color text                        -- '#0ea5e9'
);
```

### 5.2 Assets (เครื่องจักร) — entity หลัก
```sql
create table assets (
  id text primary key,              -- 'RE-1001'
  name text not null,
  type text not null references asset_types(name),
  site text not null references sites(code),
  health int default 100,           -- 0-100 (derived, cache)
  status text default 'Healthy'     -- Healthy | Warning | Critical (derived, cache)
    check (status in ('Healthy','Warning','Critical')),
  install_date date default '2020-01-01',
  motor_kw numeric,
  rpm numeric,
  vg_grade int default 46,          -- ISO VG
  oil_brand text,                   -- 'Shell Omala S2 G 46'
  oil_qty_l numeric default 20,
  oil_change_months int default 6,
  oil_sample_months int default 3,
  last_update text,                 -- 'YYYY-MM'
  created_at timestamptz default now()
);

create index on assets (site);
create index on assets (status);
```

### 5.3 Oil & Vibration Readings (time-series)
```sql
create table oil_readings (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references assets(id) on delete cascade,
  period text not null,             -- 'YYYY-MM'
  fe numeric, cu numeric, si numeric,
  water numeric, visc numeric, tan numeric,
  iso_code text,                    -- '18/16/13'
  created_at timestamptz default now(),
  unique (asset_id, period)
);

create table vib_readings (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references assets(id) on delete cascade,
  period text not null,
  vel numeric, acc numeric, cf numeric, temp numeric,
  created_at timestamptz default now(),
  unique (asset_id, period)
);

create index on oil_readings (asset_id, period);
create index on vib_readings (asset_id, period);
```

### 5.4 Maintenance History
```sql
create table maintenance_records (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references assets(id) on delete cascade,
  type text not null check (type in ('pm','cm')),
  work_date date,
  wo_no text,                       -- MNT-xxxxx
  description text,
  parts text,
  cost numeric default 0,
  technician text,
  created_at timestamptz default now()
);
```

### 5.5 Alarm / Threshold Configuration (single source of truth)
```sql
create table alarm_params (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('oil','vib')),
  key text not null,                -- 'fe','water','vel','acc',...
  name text not null,               -- 'Iron (Fe)'
  unit text,                        -- 'ppm'
  description text,
  warn_limit numeric,               -- warning threshold
  crit_limit numeric,               -- critical threshold
  unique (category, key)
);

create table score_config (
  id int primary key default 1,
  oil_weight numeric default 60,    -- %
  vib_weight numeric default 40,    -- %
  warn_penalty numeric default 15,  -- deduction at warn_limit
  crit_penalty numeric default 30   -- deduction at crit_limit
);
```
**Seed defaults (parity ต้นแบบ):**

Oil params (`OIL_P`):
| key | name | unit | warn | crit |
|---|---|---|---|---|
| fe | Iron (Fe) | ppm | 100 | 200 |
| water | Water Content | ppm | 500 | 1000 |
| tan | TAN | mgKOH/g | 0.5 | 1.0 |

Copper (Cu) และ Silicon (Si) ถูกถอดออกเมื่อ 2026-10-28 (`0031_drop_cu_si_params.sql`) เพราะผลแล็บของโรงงานไม่ได้วัดสองค่านี้ — ไม่มีช่องกรอก ไม่อ่านจาก Excel และไม่หักคะแนน คอลัมน์ `oil_readings.cu` / `.si` ยังอยู่พร้อมข้อมูลเดิม

Vib params (`VIB_P`):
| key | name | unit | warn | crit |
|---|---|---|---|---|
| vel | Velocity RMS | mm/s | 4.5 | 7.1 |
| acc | Peak Acceleration | g-PK | 5 | 10 |

Score config: oil_weight 100, vib_weight 0, warn_penalty 15, crit_penalty 30. (ต้นแบบเดิมเป็น 60/40 — เปลี่ยนใน `0024_default_oil_weighting.sql` เพราะโรงงานเริ่มจากวัดน้ำมันอย่างเดียว)

Viscosity ไม่ใช้ warn/crit ในตาราง แต่คิดจากเกรด ISO VG ของแต่ละเครื่อง (ISO 3448): Warning นอกช่วง ±5%, Critical นอกช่วง ±10% ทั้งด้านสูงและต่ำ (ดู §6)

### 5.6 PM Tasks
> **ถอดออกแล้ว (2026-10-28)** — ตารางนี้ยังอยู่ในฐานข้อมูลพร้อมข้อมูลเดิม แต่ไม่มีโมดูลในแอปใช้แล้ว และ `0029_retire_pm_permissions.sql` ถอนสิทธิ์ที่เกี่ยวข้อง (spec: `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`)
```sql
create table pm_tasks (
  id text primary key,              -- 'PM-001'
  name text not null,
  frequency text not null,          -- Daily|Weekly|Biweekly|Monthly|Quarterly|Semi Annual|Annual|Condition Based
  asset_id text not null references assets(id),
  plant text references sites(code),
  criticality text check (criticality in ('High','Medium','Low')),
  freq_days int,
  last_done date,
  next_due date,
  overdue_days int default 0,
  est_duration int default 60,      -- นาที
  skill text, technician text, planner text,
  status text default 'Scheduled'   -- Scheduled|Due Soon|Overdue
    check (status in ('Scheduled','Due Soon','Overdue')),
  loto boolean default false,
  permit boolean default false,
  created_at timestamptz default now()
);
```

### 5.7 Work Orders
> **ถอดออกแล้ว (2026-10-28)** — ตารางนี้ยังอยู่ในฐานข้อมูลพร้อมข้อมูลเดิม แต่ไม่มีโมดูลในแอปใช้แล้ว และ `0029_retire_pm_permissions.sql` ถอนสิทธิ์ที่เกี่ยวข้อง (spec: `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`)
```sql
create table work_orders (
  id text primary key,              -- 'WO-50000'
  pm_id text references pm_tasks(id),
  asset_id text not null references assets(id),
  plant text references sites(code),
  type text not null check (type in ('PM','CM','EM','Inspection')),
  priority text not null check (priority in ('Critical','High','Medium','Low')),
  status text not null default 'Open'
    check (status in ('Open','Assigned','InProgress','WaitingParts','Completed','Closed')),
  created_date date, due_date date, completed_date date,
  technician text, planner text,
  cost numeric default 0,
  description text,
  created_at timestamptz default now()
);
```

### 5.8 Alerts
> **ถอดออกแล้ว (2026-10-28)** — ตารางนี้ยังอยู่ในฐานข้อมูลพร้อมข้อมูลเดิม แต่ไม่มีโมดูลในแอปใช้แล้ว และ `0029_retire_pm_permissions.sql` ถอนสิทธิ์ที่เกี่ยวข้อง (spec: `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`)
```sql
create table alerts (
  id text primary key,              -- 'AL-1000'
  level text not null check (level in ('Critical','High','Medium','Low','Information')),
  category text not null,           -- Overdue PM|Missed PM|Critical Equipment|Upcoming PM|Inspection Due|High Maintenance Cost
  asset_id text, asset_name text, plant text,
  message text,
  status text default 'Open'
    check (status in ('Open','Acknowledged','Assigned','InProgress','Completed','Closed')),
  escalation_level int default 0,   -- 0-4 (ISA-18.2 style)
  created_at timestamptz default now()
);
```

### 5.9 Standards Library
```sql
create table standards (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('TRIBOLOGY','VIBRATION','RELIABILITY','ASSET','CUSTOM')),
  title text not null,              -- 'ISO 4406:2021'
  subtitle text,
  description text,                 -- คำอธิบาย (Thai)
  full_text text,                   -- รายละเอียดเทคนิค
  tags text[],                      -- {'Particle Count','ISO Cleanliness Code'}
  created_at timestamptz default now()
);
```
> Seed มาตรฐานอย่างน้อย 4 ฉบับ (ISO 4406:2021, ASTM D4378-20, ISO 10816-3:2009, AGMA 9005-F16, ISO 17359:2018) ตามเนื้อหาในต้นแบบ

### 5.10 Budget
> **ถอดออกแล้ว (2026-10-28)** — ตารางนี้ยังอยู่ในฐานข้อมูลพร้อมข้อมูลเดิม แต่ไม่มีโมดูลในแอปใช้แล้ว และ `0029_retire_pm_permissions.sql` ถอนสิทธิ์ที่เกี่ยวข้อง (spec: `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`)
```sql
create table budget_config (
  id int primary key default 1,
  monthly_cap numeric default 200000,   -- เพดานรายเดือน default
  ratio numeric                          -- สัดส่วน PM vs CM
);

create table monthly_caps (
  id uuid primary key default gen_random_uuid(),
  year int not null, month int not null check (month between 1 and 12),
  cap numeric, actual numeric,
  unique (year, month)
);

create table expenses (
  id text primary key,              -- 'EXP-...'
  expense_date date not null,
  description text not null,
  amount numeric not null check (amount > 0),
  machine_type text,                -- Asset type
  category text check (category in ('parts','repair')),
  project_id text,
  pr_no text, po_no text, wo_no text, vendor text,
  created_at timestamptz default now()
);

create table annual_projects (
  id text primary key,              -- 'AP-2026-001'
  name text not null,
  due_month int not null,
  budget numeric not null,
  equipment_id text references assets(id),
  status text default 'วางแผน'       -- วางแผน|อนุมัติแล้ว|เสร็จสิ้น
);
```

---

## 6. Domain Logic หลัก — Health Score (Single Source of Truth)

> สูตรนี้ต้อง implement ที่เดียว (แนะนำ Postgres function `compute_health(asset_id)` + cache ลง `assets.health/status`) และทุกหน้า UI อ่านจากค่านี้เท่านั้น

```
penalty(val, warn, crit):
  if val is null:        return 0
  pw = param.warn_penalty ?? score_config.warn_penalty   # per-param (0008), else default 15
  pc = param.crit_penalty ?? score_config.crit_penalty   # per-param (0008), else default 30
  if val > crit:         return pc
  if val > warn:         return pw          # step — flat, NOT interpolated (0026)
  return 0

penalty_visc(val, vg):                     # viscosity only, when the asset has a VG grade (0027)
  if val > vg*1.10 or val < vg*0.90:  return pc
  if val > vg*1.05 or val < vg*0.95:  return pw
  return 0

oilScore  = 100 − Σ penalty(oil[key], oil_param.warn, oil_param.crit)   for each oil param (visc → penalty_visc)
vibScore  = 100 − Σ penalty(vib[key], vib_param.warn, vib_param.crit)   for each vib param
oilScore  = max(0, oilScore);   vibScore = max(0, vibScore)

health    = oilScore * (oil_weight/100) + vibScore * (vib_weight/100)   # ถ้ามีข้อมูลทั้งสองชนิด
            (มีเฉพาะ oil → oilScore | เฉพาะ vib → vibScore | ไม่มีเลย → 100)
health    = clamp(round(health), 0, 100)

status    = health < 40 ? 'Critical'
          : health < 80 ? 'Warning'
          : 'Healthy'
```

### ทริกเกอร์คำนวณใหม่
- เมื่อ insert/update `oil_readings`, `vib_readings`
- เมื่อ update `alarm_params` หรือ `score_config` → recompute ทุก asset (เหมือนปุ่ม "บันทึก" ในต้นแบบที่คำนวณใหม่ทั้งระบบ)

### Health Score Audit (Deduction Breakdown)
แสดงรายการแยกหมวด Oil / Vibration: พารามิเตอร์ · เหตุผล · ค่าที่อ่านได้ · penalty พร้อมคะแนนของแต่ละหมวด แล้วรวมเป็น `(oilScore × oil_weight% + vibScore × vib_weight%) ÷ 100 = netScore` (เหมือนกันทั้งหน้า Alarm Config และ Drill-down > Health tab)

คะแนนเครื่องจักรติดลบไม่ได้: คะแนนแต่ละหมวดต่ำสุดคือ 0 และรายการที่หักในหมวดเดียวกันต้องรวมกันไม่เกิน 100 (หักจากรายการที่หักมากที่สุดก่อน รายการที่หักไม่ได้เต็มจำนวนจะแสดงค่าที่หักจริงพร้อมเกณฑ์เต็ม) ฐานข้อมูลบังคับ `assets.health` ให้อยู่ระหว่าง 0–100 (`0028_health_range_check.sql`)

---

## 7. Feature Specifications (โมดูล 1–8 + §7.17)

> แต่ละ module กำหนด: route · ผู้ใช้ · ฟังก์ชันหลัก · parity notes

### Module Map & Release Phase

| # | โมดูล | Route | Phase |
|---|---|---|---|
| 1 | Fleet Risk Center (Dashboard) | `/dashboard` | P0 |
| 2 | Asset Watchlist | `/watchlist` | P0 |
| 3 | Drill-down Analysis | `/assets/[id]` | P0 |
| 4 | Data Entry (Oil/Vib) | `/data-entry` | P0 |
| 5 | Asset Database | `/assets` (CRUD) | P0 |
| 6 | Standards Library | `/standards` | P0 |
| 7 | Alarm Configuration | `/config/alarms` | P0 |
| 8 | Board-Level Reports | `/reports` | P0 (basic) → P2 (full) |
| 9 | ~~PM Compliance Hub~~ | ~~`/pm/compliance`~~ | ถอดออก 2026-10-28 |
| 10 | ~~PM Calendar~~ | ~~`/pm/calendar`~~ | ถอดออก 2026-10-28 |
| 11 | ~~Work Orders~~ | ~~`/work-orders`~~ | ถอดออก 2026-10-28 |
| 12 | ~~PM Master Setup~~ | ~~`/pm/setup`~~ | ถอดออก 2026-10-28 |
| 13 | ~~PM Alert Center~~ | ~~`/pm/alerts`~~ | ถอดออก 2026-10-28 |
| 14 | ~~EAM/CMMS Reporting Center~~ | ~~`/eam`~~ | ถอดออก 2026-10-28 |
| 15 | ~~AI Reliability Center (RUL)~~ | ~~`/ai-reliability`~~ | ถอดออก 2026-10-28 |
| 16 | ~~Budget Tracker~~ | ~~`/budget`~~ | ถอดออก 2026-10-28 |
| 17 | ~~Oil Sampling Cycle (รอบเก็บตัวอย่างน้ำมัน)~~ | ~~`/sampling`~~ | ถอดออก 2026-10-28 |

---

### 7.1 Fleet Risk Center (Dashboard) — P0
**ผู้ใช้:** ทุกบทบาท | **Parity:** dashboard ในไฟล์ `pg-dash`

- **KPI cards (4):** สินทรัพย์รวม / วิกฤต / เฝ้าระวัง / ปกติ (อ่านจาก `assets.status`)
- **Site filter pills:** Global + ทุก site (NY1/PCD/SA/TSL/UT) พร้อมจำนวน asset ต่อ site
- **Site Reliability chart:** Stacked bar (Healthy/Warning/Critical) + line (Avg Health %) ต่อ site — Chart.js
- **Priority Action Feed:** Top 10 critical assets (เรียงตาม health น้อยสุด)
- **Risk Concentration by Equipment Type:** แถบแนวนอน stacked เรียงจากวิกฤตสูงสุด → คลิกเปิด Watchlist filter
- **Fleet summary table:** ค้นหา + filter status + pagination (20/หน้า) + ปุ่ม "วิเคราะห์"

### 7.2 Asset Watchlist — P0
**Parity:** `pg-watch`

- Filter: site, ค้นหา ID/ชื่อ, status tab (ทั้งหมด/วิกฤต/เฝ้าระวัง/ปกติ), เรียง health น้อย→มาก
- Row: avatar (abbr + สีประเภท) · ชื่อ + ID · site · status badge · health bar · last update · ปุ่มวิเคราะห์
- Pagination 20/หน้า

### 7.3 Drill-down Analysis — P0
**Route:** `/assets/[id]` | **Parity:** `pg-detail` (renderDetail)

Header: ชื่อ · status badge · type · site · run-hours · Health Index · last update · ปุ่ม Export + AI

**6 แท็บ (ต้องครบ):**
1. **Wear** — trend line chart (Fe/Cu/Si) + ผลแล็บล่าสุด (Fe, Cu, Si, ISO Cleanliness) พร้อม warning/critical limit
2. **Oil** — trend (Viscosity/Water) + KPI (Viscosity, Water, TAN) + **Lubrication Master Data** (ชนิดน้ำมัน, ปริมาณ, รอบเปลี่ยน/เก็บตัวอย่าง) + สถานะครบกำหนดเปลี่ยนถ่าย/เก็บตัวอย่าง (ปกติ/ใกล้ครบ/เลยกำหนด)
3. **Vibration** — history chart (Velocity bar + Peak Accel line) + KPI (Velocity RMS, Peak Acceleration) vs ISO 10816-3 limit
4. **Health** — Deduction breakdown (audit) + Deduction Criteria Reference table
5. **Maintenance** — ฟอร์มบันทึก (WO no, date, type, desc, parts, cost, tech) + timeline history (ลบได้)
6. **Intelligence** — RCA Failure Mode Probability bar (Bearing Fatigue/Lube Failure/Misalignment/Imbalance/Seal Wear/Contamination) + ข้อมูลจำเพาะ + **AI Diagnostic panel**

### 7.4 Data Entry (Oil/Vib) — P0
**Parity:** `pg-input` + `diSubmit`

- ค้นหา + filter site + เลือกเครื่องจักร (แสดง 50 รายการแรก)
- แสดงข้อมูลเครื่องปัจจุบัน (type, site, sample ก่อน, status)
- Toggle **Oil / Vibration**
- **Oil form:** date, Fe, Cu, Si, Water, Viscosity, ISO Code (validate `XX/XX/XX`), TAN
- **Vib form:** date, Velocity RMS, Peak Accel, Crest Factor, Bearing Temp
- Validation: ค่าติดลบ, ISO format, ต้องกรอก ≥1 ค่า
- บันทึกแล้ว upsert reading ตาม period → recompute health → toast
- **นำเข้าผลแล็บจาก Excel** (ทีละเครื่อง หรือ batch ทั้งไฟล์):
  - จับคู่ TAG กับ `assets.id`: ตรงเป๊ะ หรือตรงหลังตัดช่องว่าง/ขีด/จุดและมีเครื่องเดียว → เลือกให้อัตโนมัติ; ใกล้เคียง → แค่แนะนำให้ผู้ใช้กดเลือก; ไม่พบ/ไม่มี TAG → ห้ามบันทึกจนกว่าผู้ใช้เลือกเครื่อง · **ห้ามสร้างเครื่องจักรใหม่อัตโนมัติ**
  - วันที่เก็บตัวอย่าง → งวด `YYYY-MM`: รองรับ Excel serial, ชื่อเดือนไทย/อังกฤษ, ปี พ.ศ.; วัน/เดือนกำกวม (เช่น 03/04) ให้เตือนตรวจ; อ่านไม่ได้ → ให้ผู้ใช้เลือกเดือนเอง
  - ISO 4406 รับเฉพาะรหัสที่เป็นไปได้: 3 ค่า แต่ละค่า ≤ 30 และไม่เพิ่มขึ้นตามขนาดอนุภาค (4µm ≥ 6µm ≥ 14µm) — กันวันที่อย่าง `9/7/26` ถูกอ่านเป็น ISO
  - Batch: แต่ละแถวมีสถานะ พร้อม / ต้องตรวจ / ข้าม (ไม่มีค่าผลตรวจ) นำเข้าเฉพาะแถวที่พร้อม แถวที่เหลือยังอยู่ให้แก้แล้วนำเข้าต่อ

### 7.5 Asset Database (CRUD) — P0
**Parity:** `pg-db` + modals

- Table: checkbox (bulk delete), ID, ชื่อ, type badge, site, last update, actions (ดู/แก้ไข/ลบ)
- Filter site + ค้นหา + pagination
- **Add/Edit modal:** ID, name, type, site, ISO VG, kW, RPM, install date, oil brand, oil qty, change/sample months
- Validation: ID ซ้ำ, kW/VG/RPM/qty/months > 0
- **Import/Export JSON** (parity `dbImport`/`dbExport`) + Delete all + Bulk delete

### 7.6 Standards Library — P0
**Parity:** `pg-std`

- Grid card 3 col · filter category (TRIBOLOGY/VIBRATION/RELIABILITY/ASSET/CUSTOM) + ค้นหา
- การ์ด: category badge (สีตามหมวด), title, subtitle, tags
- **Detail modal:** overview, full technical reference, tags, code
- **Add modal:** title, category, subtitle, description (TH), full text, tags (comma-separated)

### 7.7 Alarm Configuration — P0
**Parity:** `pg-alarm`

- **Health Score Audit:** เลือก asset → แสดง deduction breakdown + net score (real-time)
- **Score Weighting:** Oil% / Vibration% (auto-balance รวม 100)
- **Oil/Vibration Limits forms:** edit warn/critical แต่ละพารามิเตอร์
- **Deduction Criteria Reference table:** edit warn_penalty/crit_penalty + limits ได้ในตาราง (blur/Enter ยืนยัน)
- **Reset to default** + **Save** (recompute health ทุก asset)
- Notice: การแก้ limit มีผลต่อ health/status ทุกเครื่องทันที

### 7.8 Board-Level Reports — P0 (basic) → P2 (full PDF)
**Parity:** `pg-report`

- Config: site (ทุกโรงงาน หรือโรงงานเดียว — ทั้งรายงานพูดถึงขอบเขตนั้น), report type ตามคนอ่าน: **Executive Summary** (ผู้บริหาร, 1 หน้า) / **Plant Report** (ผู้จัดการโรงงาน) / **Oil Analysis Technical Report** (วิศวกร), prepared/reviewed/approved by, หมายเหตุผู้จัดทำ — ยังไม่มีตัวกรองช่วงเวลา: รายงานแสดงสถานะล่าสุด ("ข้อมูล ณ วันที่")
- เนื้อหา: ผลการประเมิน (จากจำนวนเครื่องวิกฤต/เฝ้าระวัง ไม่ใช่ค่าเฉลี่ย) → บทสรุป (เครื่องวิกฤตพร้อมปัญหาที่พบและสิ่งที่ควรทำ จากข้อความชุดเดียวกับ Dashboard) → KPI → ตารางตามประเภทรายงาน → ข้อเสนอแนะ → ลงนาม; ข้อความทั้งหมดมาจาก `lib/exec-summary-text.ts` (`reportTexts`) ใช้ร่วมกับอีเมล
- **Generate** → preview + หน้าพิมพ์ A4 (Save as PDF) · ส่งอีเมลบทสรุปของรายงานนั้น (`reports:send_email`, server สร้างข้อความเอง)
- แก้ไขข้อความ (`reports:edit`, 0036): แก้ได้เฉพาะข้อความบรรยาย ตัวเลข/ผลการประเมิน/ตารางล็อก · ใช้ทั้ง preview, หน้าพิมพ์, อีเมล · บันทึก Audit (EDIT / SEND)
- ไม่มีบทสรุปจาก AI (ถอดออก 2026-11-06 — ข้อความจากข้อมูลจริงเท่านั้น)

### 7.9–7.16 (ถอดออกแล้ว)
PM Compliance Hub, PM Calendar, Work Orders, PM Master Setup, PM Alert Center, EAM Reporting, AI Reliability Center และ Budget Tracker (รวม AI Fleet Chat) ถูกถอดออกจากแอปเมื่อ 2026-10-28 — ดู `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md` และ git history สำหรับ spec เดิม เมื่อผลแล็บเกินเกณฑ์ หน้า Data Entry แสดง "ค่าเกินเกณฑ์ ควรเปิดงานซ่อม" แทนการสร้าง Work Order

### 7.17 ~~Oil Sampling Cycle (รอบเก็บตัวอย่างน้ำมัน)~~ — ถอดออก 2026-10-28

หน้า `/sampling` และปุ่ม "เครื่องถัดไปในรอบเก็บตัวอย่าง" ใน Data Entry ถูกถอดออก ยังเก็บ `assets.oil_sample_months` และเดือนเก็บตัวอย่างถัดไปในหน้า Drill-down ไว้

---

## 8. AI Integration (Multi-Provider)

### ทางเข้า: `POST /api/ai/diagnose` (Route Handler, server-only)
- รับ `{ assetId }` → ดึงข้อมูล asset + latest oil/vib + thresholds จาก Supabase (service role)
- เลือก provider ตาม `AI_PROVIDER` env
- สร้าง prompt (parity ต้นแบบ) ส่งให้ LLM, parse JSON response

### Provider abstraction
```ts
// lib/ai/provider.ts
type AIProvider = { diagnose(payload: DiagnoseInput): Promise<DiagnoseResult> }
// lib/ai/{glm,openai,anthropic}.ts  — implement AIProvider แต่ละตัว
// ทุก provider ต้อง return schema เดียวกัน:
type DiagnoseResult = {
  summary, primaryAnomaly, confidencePct,
  oilAnalysis, vibrationAnalysis, rootCauseHypothesis,
  actionPlan: { immediate: string[], shortTerm: string[], longTerm: string[] }
}
```
- **GLM (default):** model `glm-5.2`, ใช้ zai/glm endpoint
- API key เก็บใน `AI_API_KEY` (server env) — **ห้าม expose สู่ client**
- Fallback: หาก provider ล้มเหลว แสดงข้อความ error + (optional) rule-based RCA

### จุดใช้งาน
- Drill-down > Intelligence tab (per-asset diagnostic, RCA)
- Reports > Executive AI Summary
- Standards Library > AI standard lookup

---

## 9. Design System (parity ต้นแบบ Apple-style)

### Color tokens (เทียบเท่า Tailwind config)
| Token | Hex | การใช้ |
|---|---|---|
| bg / bg2 / bg3 | #f5f5f7 / #ffffff / #fafafc | พื้นหลัง, การ์ด |
| border | #e0e0e0 | เส้นขอบ |
| cyan / cyan-dark / cyan-focus | #0066cc / #2997ff / #0071e3 | primary, sidebar accent |
| green / yellow / red | #22c55e / #f59e0b / #ef4444 | Healthy / Warning / Critical |
| purple / pink | #8b5cf6 / #e0559a | Vibration / accent |
| t1 / t2 / t3 | #1d1d1f / #333333 / #7a7a7a | text 1/2/3 |

### Typography
- Display/Text: Inter / SF Pro (system-ui fallback)
- Mono (IDs, ตัวเลข): JetBrains Mono

### Layout components (สร้างเป็น React components)
- `Sidebar` (174px, ดำ, 2 ส่วน: MAIN MODULES + PM MANAGEMENT CENTER, status footer)
- `Topbar` (50px, frosted glass, title + active plant + notification bell + avatar)
- `KpiGrid` / `KpiCard` (top accent bar ตาม status)
- `Card` · `Badge` (crit/warn/ok) · `Pills` · `Button` (p/g/ai/ok/del, sm/xs)
- `DataTable` + pagination · `Modal` · `Toast`
- Notification panel (bell dropdown)

### Status conventions (parity)
- Health: <40 Critical (red) · <80 Warning (yellow) · ≥80 Healthy (green)
- Asset type color map (parity `TC`)
- Responsive: grid degrade ที่ ≤1100px และ ≤760px (sidebar 60px collapse)

---

## 10. Non-Functional Requirements

| ด้าน | ข้อกำหนด |
|---|---|
| **Performance** | หน้า Dashboard/Watchlist load < 2s สำหรับ 500 assets; pagination 20/หน้า; chart ใช้ `maintainAspectRatio:false` |
| **Security** | RLS ทุกตาราง, service role key server-only, AI key server-only, input validation (zod), SQL parameterized (Supabase client) |
| **Accessibility** | semantic HTML, aria-label, keyboard focus, สี status มี label คู่กัน |
| **i18n** | ไทยเป็นหลัก + label อังกฤษ (parity) |
| **Resilience** | toast ทุก action, confirm modal ก่อน delete, validation ทุกฟอร์ม |
| **Deployment** | Vercel (preview deploy ทุก PR), env แยก dev/prod |
| **Data** | Health/Status cache + recompute trigger; soft consideration: audit log การแก้ thresholds |

---

## 11. Definition of Done (per module)
1. Route + RBAC guard ครบตามบทบาท
2. parity ฟีเจอร์ + สูตรคำนวณกับต้นแบบ
3. ดึง/เขียน Supabase ผ่าน RLS (ไม่ใช่ mock)
4. Validation + toast + confirm ครบ
5. Responsive + parity ดีไซน์
6. Export (ที่เกี่ยวข้อง) ทำงาน
7. ไม่มี console error; typecheck (tsc) ผ่าน

---

## 12. 🧱 Phase Implementation Prompts (สำหรับ Stacking)

> คัดลอกแต่ละบล็อกด้านล่างเป็น user prompt รอบถัดไป หลังจากวาง PRD นี้เป็น context แล้ว

### 🔵 STACK 2 — Phase P0 (Foundation + Core CM)
```
Implement Phase P0 ของ UGT Reliability Lube Monitoring ตาม PRD:
1) Setup Next.js 14 App Router + TypeScript + Tailwind + @supabase/ssr; สร้าง design-system components (Sidebar/Topbar/Card/KpiGrid/Badge/Pills/Button/DataTable/Modal/Toast) parity ต้นแบบ
2) Supabase: schema ส่วน 5.1–5.5 + 5.9 + RLS + seed reference data (sites, asset_types, alarm_params defaults, score_config, standards 5 ฉบับ) + Postgres function compute_health(asset_id)
3) Auth + RBAC: profiles, role middleware, /login, route guard
4) Health Score engine (สูตร section 6) เป็น server service, recompute trigger เมื่อ insert reading/แก้ threshold
5) Modules: Dashboard, Watchlist, Drill-down (6 tabs ยกเว้น AI panel), Data Entry, Asset Database CRUD+import/export, Standards Library, Alarm Config, Reports (basic preview)
6) Deploy ขึ้น Vercel ได้. ใช้ Chart.js. ห้าม mock data — ดึงจาก Supabase. รักษา single scoring formula. ส่งมอบ: รายการไฟล์ที่สร้าง + คำสั่ง migrate/seed + ตัวอย่าง env.
```

### 🟡 STACK 2 — Phase P1 (PM Operations)
> ประวัติ — โมดูลของ phase นี้ถอดออกแล้ว (2026-10-28) ยกเว้นส่วนที่เกี่ยวกับโมดูล 1–8
```
Implement Phase P1 ต่อจาก P0 ตาม PRD — schema ส่วน 5.6–5.8 (pm_tasks, work_orders, alerts) + seed generator logic parity (genPMTasks/genWorkOrders/genAlerts):
- PM Compliance Hub (KPI + trend + overdue table + AI/rule summary)
- PM Calendar (month grid + event colors)
- Work Orders (Kanban + List views, filters, sort, create/edit/delete modal)
- PM Master Setup (table + add/edit modal + LOTO/Permit)
- PM Alert Center (KPI, filters, escalation dots, ISA-18.2 workflow, bulk acknowledge)
- เชื่อม maintenance_records กับ Drill-down > Maintenance tab + Work Orders
- คำนวณ overdueDays/status และ escalation ฝั่ง server. Deploy ได้.
```

### 🟣 STACK 2 — Phase P2 (Executive + AI)
> ประวัติ — EAM, AI Reliability, Budget ถอดออกแล้ว (2026-10-28); Reports full PDF และ AI Diagnostic ยังอยู่
```
Implement Phase P2 ต่อจาก P1 ตาม PRD — schema ส่วน 5.10 (budget) + AI provider abstraction:
- AI integration: /api/ai/diagnose (multi-provider GLM/OpenAI/Anthropic via env, key server-only), ใช้ใน Drill-down>Intelligence, PM Hub, EAM
- EAM/CMMS Reporting Center (KPI + 4 charts + Executive AI Summary + CSV/JSON/Print-PDF)
- AI Reliability Center (Weibull distribution + Top 15 ranking + RUL table + disclaimer)
- Budget Tracker (3 tabs: Core Budget, Monthly Caps, Annual Planner + expense modal + charts)
- Reports ขยาย: PDF generation (jsPDF+html2canvas A4, พร้อมกราฟ + ลงนาม), report history
- Production hardening: error boundaries, loading states, empty states. Deploy ได้. ทุก module ผ่าน Definition of Done.
```

---

## 13. หมายเหตุ parity สำคัญ (ห้ามพลาด)
- **Single scoring formula** — `healthPenalty` + oil/vib weighting เดียวกันทุกหน้า
- Health ทุกที่ (Dashboard KPI, Watchlist bar, Drill-down, Alarm Audit, AI Reliability ranking) ต้องตรงกัน
- การ Save alarm/threshold → recompute health ทุก asset (parity ปุ่ม "บันทึก")
- AI ในต้นแบบเรียก Claude ตรงจาก frontend (ไม่ปลอดภัย) → ระบบจริงต้องผ่าน Route Handler เท่านั้น
- ข้อมูลตัวอย่างในต้นแบบสุ่ม (mkOil/mkVib/mkAsset) → ระบบจริงใช้ seed script สร้าง 500 assets + readings จริงใน DB เพื่อทดสอบ
- สี/label/ตัวย่อประเภทเครื่องจักร + site codes ต้องตรงต้นแบบ
