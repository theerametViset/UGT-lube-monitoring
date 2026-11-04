# AGENTS.md

High-signal guidance for Kilo/agent sessions in this repo. For detail, open the referenced files.

## Repo state
- **Lubrication monitoring only.** Live modules: Dashboard, Watchlist, Drill-down (6 tabs + AI Diagnostic), Data Entry (+file attach/Excel-extract), Asset DB, Standards, Alarm Config, Reports (pro print/PDF), Admin (users, roles, notifications, audit). Build passes (`typecheck` + `lint` + `build`): Next.js 14.2.35 · React 18 · TS · Tailwind v3 · @supabase/ssr · Chart.js.
- **The PM Management Center was removed on 2026-10-28** (PM Compliance Hub, PM Calendar, Work Orders, PM Master Setup, PM Alert Center, EAM Reporting, AI Reliability Center, AI Fleet Chat, Budget Tracker — spec `docs/superpowers/specs/2026-10-28-remove-pm-modules-design.md`). App code is gone; the DB tables from `0001` (`pm_tasks`, `work_orders`, `alerts`, budget tables) are **kept on purpose**, empty (their seed/column migrations were deleted 2026-11-03), and `0029` revokes their permissions. Do not rebuild these modules unless asked. The **Oil Sampling Cycle** page (`/sampling`) and Data Entry's "next machine in the sampling round" button were removed the same day; `assets.oil_sample_months` and Drill-down's next-sample month (`lib/sampling.ts`) stay. **Copper (Cu) and Silicon (Si)** are no longer entered, read from Excel or scored (`0031`); the `oil_readings.cu/si` columns stay. A reading over its limits shows "ค่าเกินเกณฑ์ ควรเปิดงานซ่อม" in Data Entry (repair jobs are opened in another system). **Machine list** = `Final equipment in program.xlsx` (569 oil machines, 2026-11-03) in `lib/demo-data.ts` `RAW_ASSETS`; `0032_real_equipment.sql` loads the same list into Supabase. **Open security items before going live:** `Plan.md` PV-016. **AI** = `/api/ai/diagnose` (multi-provider GLM/OpenAI/Anthropic, server-only key) with **rule-based fallback** (works without `AI_API_KEY`). **Demo Mode** (`DEMO_MODE=true`) previews all modules; writes are read-only until real Supabase env is provided. Remaining = user setup: Supabase project + run every `supabase/00NN_*.sql` in numeric order + turn off "Enable signups" in Supabase Auth (there is no signup page; admins create accounts) + promote first user to admin + Vercel deploy + RLS/parity re-test.
- The spec files are the product truth. The `HTML/` prototype is **reference UI/UX + scoring logic**, not a target to copy blindly.

## Source-of-truth (trust order — if they disagree, fix the doc, keep prototype + SQL)
| Need | Read |
|---|---|
| Scope, data model, scoring formula, modules, design tokens | `PRD.md` |
| Step-by-step tasks + progress | `Plan.md` |
| The 3-stack prompt workflow | `STACK_PHASE_PROMPTS.md` |
| Exact UI/UX, colors, charts, JS logic | `HTML/Lubrication_monitoring_final2 (1).html` |
| Schema, RLS, functions, seed | `supabase/0001_schema.sql`, `supabase/0002_seed.sql`, then later migrations (a later file can redefine a function) |

## 🔴 Iron rule — do not violate
**Health Score = ONE formula, computed server-side only** (`compute_health(asset_id)`, latest definition in `0027_visc_by_vg_grade.sql`; `0028_health_range_check.sql` adds a 0–100 CHECK on `assets.health`; spec `PRD.md` §6).
- Never recompute health/status on the client. Read `assets.health` / `assets.status` everywhere — they are the cache `compute_health` maintains via triggers.
- `lib/scoring/audit.ts` (`getDeductionBreakdown`) is the TypeScript parity port — it drives the breakdown UI and, in Demo Mode, `getDemoAssets()` computes every asset's health with it. Any change to the formula must land in both the SQL (new migration) and this file.
- Every page (Dashboard, Watchlist, Drill-down, Alarm Audit, Reports) must show identical scores for the same asset.
- Saving thresholds / score_config must call `recompute_all_health()` (mirrors the prototype's "บันทึก" button).

## How to run this repo's workflow
1. Stack 1 = paste `PRD.md` as master context.
2. Stack 2 = copy a phase block from `STACK_PHASE_PROMPTS.md` (P0 → P1 → P2) as the next prompt.
3. Each phase deploys to Vercel before the next begins.
4. Track progress in `Plan.md` (`- [ ]` → `- [x]`).

## DB setup order (exact order — required)
1. `supabase/0001_schema.sql` — schema + RLS + `compute_health` + triggers + auto-profile.
2. `supabase/0002_seed.sql` — reference data (prototype sites/types, later replaced by 0032) + alarm defaults + 5 standards. No sample machines.
3. `supabase/0003_attachments.sql` — `reading_attachments` table + private Storage bucket `lab-attachments` + policies.
4. Every later file (`0007` → latest) in numeric order — each file's header comment says what it changes and what it must run after. `0032` loads the 569 real machines.
- `0004`–`0006`, `0018`, `0019` (PM / Work Order / Budget seeds and columns) were deleted on 2026-11-03, before any real database ran them; the PM/WO/budget tables from `0001` stay, empty. All 28 files run clean on a fresh Postgres (tested on PGlite 2026-11-03).
- Do NOT change seed thresholds/alarm defaults without also updating `PRD.md` §5.5 — they must stay identical.

## Security — the prototype does this WRONG, do not copy
- AI provider calls (GLM/OpenAI/Anthropic) go through a server Route Handler only. Keys in `AI_API_KEY` (server env), never `NEXT_PUBLIC_*`.
- The prototype HTML calls the LLM directly from the frontend — that is the bug, not the pattern.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only.

## Parity conventions — match prototype; pull from seed, don't invent
- Site codes: the SQL seed (`0002_seed.sql`) still has the prototype codes `UT, PCD, SA, TSL, NY1`; Demo Mode (`lib/demo-data.ts`) uses the real plants from the equipment Excel, `CPL, TSL, UFA, UNT, UTCA`. `0032_real_equipment.sql` (generated from `lib/demo-data.ts` by `scripts/gen-real-equipment-sql.py`) adds the real plants and types, inserts the machines not there yet (`on conflict do nothing` — it never updates an existing machine) and removes unused prototype plants/types — regenerate it if the machine list changes. Changes to machines already in the database go through the Asset DB import. Asset type colors/abbreviations: from `lib/demo-data.ts` `getDemoReference()`.
- Status: `<40 Critical`, `<80 Warning`, `≥80 Healthy`. UI is Thai-primary + English labels (bilingual).

## Lab Excel import — rules (PRD §7.4)
- Never auto-create assets. `lib/asset-match.ts` `matchTag`: exact or unique normalized TAG auto-selects; fuzzy matches are suggestions only; unknown/empty TAG blocks saving. Lab TAGs often differ from `assets.id` (`06-K01-B` vs `06-K01B`).
- Sampling date → period via `lib/parse/period.ts` (`parseSamplingPeriod`, `isPeriod`); never guess a month silently.
- ISO 4406 via `isoCodeIn` (`lib/parse/batch.ts`): only non-increasing codes ≤ 30 — otherwise d/m/yy dates (`9/7/26`) get stored as ISO.
- Local Store saves check the asset exists (`isDemoAssetId`) — rows for unknown assets break the SQL export's foreign keys.
- Batch import saves the whole file with `saveOilBatch` (`lib/actions/readings.ts`): one upsert per set of columns, so a file without a column never writes null over a saved value. Rows whose machine + month already have a reading wait for the user's "ยืนยันทับ".
- Periods in the future are refused everywhere (`isFuturePeriod`); a mistyped year would otherwise stay the "latest" reading.
- Numbers: a numeric cell's raw value wins over its formatted text (`cellNumber(text, raw)`); text "0,050" is a decimal comma. ISO codes may be `-/16/13` (microscope count); a header with "VG" is never the ISO 4406 column.
- Blank cell ≠ 0: VG 0 means "no VG (e.g. SAE grade)" — viscosity is then checked against the generic `alarm_params` visc limits (242/264 by default), in SQL and TS alike. Never turn 0 into a default (`cellNum` in `lib/asset-import.ts`); a new machine imported without VG gets 0.

## Stack
Next.js 14 App Router · React 18 · TypeScript · Tailwind · @supabase/ssr · Chart.js + react-chartjs-2 · jsPDF + html2canvas · zod. Deploy: Vercel. DB: Supabase Postgres. Env vars: `PRD.md` §3.

## Dev commands (verified working — npm scripts)
- Dev `npm run dev` · Build `npm run build` · Typecheck `npm run typecheck` (`tsc --noEmit`) · Lint `npm run lint`.
- Pre-commit order: typecheck → lint → build.
- Without real Supabase env in `.env.local`, `npm run dev` runs in Demo Mode automatically (`lib/env.ts`).
- The machine list changes → edit `lib/demo-data.ts` `RAW_ASSETS`, then `python scripts/gen-real-equipment-sql.py` to regenerate `supabase/0032_real_equipment.sql`.
- `npm start` listens on `127.0.0.1` only (Local Store has no login).
- **Local Store** (`LOCAL_STORE=true` + Demo Mode, never on Vercel): Data Entry really saves oil/vib readings + lab files to `.local-data/` (git-ignored) via `lib/local-store.ts`, with rows in the exact Supabase column shape. Saved readings merge into demo history, so `getDemoAssets()` recomputes health with the parity port and every page agrees. `/api/local-store/export` downloads an upsert SQL script (ends with `recompute_all_health()`) to move the data to Supabase or a company Postgres server. No login or RLS: one machine only. Other modules stay read-only. For real data, set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (and `DEMO_MODE=false`).
- Tests: `npm test` (vitest).
- After each module: verify Health Score parity across all pages; update `Plan.md` checkboxes.

## Git
Git repo, main branch `master`. Never commit `.env*`.
