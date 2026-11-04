# UGT Reliability Lube Monitoring

Condition-monitoring and reliability platform for industrial lubrication and vibration analysis — asset health scoring, oil/vibration readings, PM/work-order management, AI-assisted diagnostics, and executive reporting.

Built with Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Postgres/Auth/Storage).

> Looking for the full product spec, module list, and design tokens? See [`PRD.md`](PRD.md). Looking for agent/AI-assistant working conventions (iron rules, source-of-truth order)? See [`AGENTS.md`](AGENTS.md).

## Prerequisites

- Node.js 20+
- A Supabase project ([supabase.com](https://supabase.com)) — or skip this and run in **Demo Mode** (see below)

## Quick start (Demo Mode — no Supabase needed)

Demo Mode previews every module with realistic sample data; writes are accepted in the UI but not persisted.

```bash
npm install
npm run dev
```

Demo Mode activates automatically whenever Supabase env vars aren't set. Open http://localhost:3000.

## Full setup (real Supabase backend)

1. Copy the env template and fill in your Supabase project's values:
   ```bash
   cp .env.example .env.local
   ```
   Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only — never expose this one to the client). `AI_API_KEY` is optional — without it, AI features fall back to rule-based logic.

2. In the Supabase SQL Editor, run every file in `supabase/` **in numeric order** (each depends on the ones before it):
   ```
   0001_schema.sql   → tables, RLS, compute_health(), triggers, auto-profile
   0002_seed.sql     → reference data + alarm defaults + 5 standards
   0003_attachments.sql
   0007_particle.sql … 0033_latest_oil_view.sql   (0004–0006, 0018, 0019 were removed)
                       0032_real_equipment.sql loads the 569 real machines
   ```
   Do not change seed thresholds/alarm defaults without also updating `PRD.md` §5.5 — they must stay identical (single source of truth for health scoring).

3. Sign up through the app's `/signup` page, then promote your own account to `admin` directly in Supabase (`profiles` table, `role` column) — the first user isn't auto-promoted.

4. Set `DEMO_MODE=false` in `.env.local` (or just remove it — Demo Mode auto-disables once real Supabase values are present).

5. Run the dev server:
   ```bash
   npm run dev
   ```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `next lint` |
| `npm run test` | Run the Vitest suite |

Pre-commit order: `typecheck` → `lint` → `test` → `build` (all four run automatically on push/PR via `.github/workflows/ci.yml`).

## Deploying (Vercel)

1. Import the repo into Vercel.
2. Set the same env vars from `.env.local` in the Vercel project settings (Production + Preview).
3. Deploy — `next build` runs automatically.

## Health Score — read before touching scoring code

Health score is computed **only** server-side by `compute_health()` (`supabase/0001_schema.sql`) and cached on `assets.health`/`assets.status` via triggers. Every page reads that cached value — never recompute it client-side. See `AGENTS.md` for the full rule and `PRD.md` §6 for the formula.
