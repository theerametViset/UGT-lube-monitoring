// The iron rule, tested: compute_health (SQL, the only score the app stores) and its TypeScript
// port getDeductionBreakdown (breakdown UI, Demo Mode) must give the same Health Score.
// Runs every migration on an in-memory Postgres (PGlite), then scores the same readings both ways.
import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getDeductionBreakdown } from "./audit";
import type { AlarmParam, OilReading, ScoreConfig, VibReading } from "@/lib/types";

const SQL_DIR = path.join(__dirname, "..", "..", "supabase");
let db: PGlite;

// What Supabase provides and the migrations expect: roles, auth.uid(), a storage schema.
const SUPABASE_STANDINS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select 'service_role' $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
`;

const OIL = ["fe", "water", "visc", "tan", "particle_4", "particle_6", "particle_14"] as const;
const VIB = ["vel", "acc", "cf", "temp"] as const;
const num = (v: unknown) => (v == null ? null : Number(v));

interface Case {
  id: string;
  vg: number;
  oil?: Partial<Record<(typeof OIL)[number], number>>;
  vib?: Partial<Record<(typeof VIB)[number], number>>;
  paramOverride?: { category: "oil" | "vib"; key: string; warn_limit?: number; crit_limit?: number; warn_penalty?: number; crit_penalty?: number };
  scoreOverride?: Partial<ScoreConfig>;
}

const CASES: Case[] = [
  { id: "T-HEALTHY", vg: 46, oil: { visc: 46, tan: 0.1, water: 100 } },
  { id: "T-VISC-HIGH", vg: 46, oil: { visc: 53 } }, // above the VG 46 band
  { id: "T-VISC-LOW", vg: 46, oil: { visc: 39 } }, // below it
  { id: "T-VG0", vg: 0, oil: { visc: 250 } }, // no VG grade: generic viscosity limits
  { id: "T-WARN-ONLY", vg: 68, oil: { tan: 0.7 } },
  { id: "T-CRIT", vg: 320, oil: { tan: 2, water: 1000, fe: 200, visc: 330 } },
  { id: "T-OVERRIDE", vg: 46, oil: { tan: 0.7 }, paramOverride: { category: "oil", key: "tan", warn_limit: 1, crit_limit: 2 } },
  { id: "T-BOTH", vg: 46, oil: { tan: 2 }, vib: { vel: 5 }, scoreOverride: { oil_weight: 60, vib_weight: 40 } },
  { id: "T-VIB-ONLY", vg: 46, vib: { vel: 8, acc: 6 } },
];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  for (const f of fs.readdirSync(SQL_DIR).filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort()) {
    // gen_random_uuid() is built in (PG 13+); PGlite can't load pgcrypto / uuid-ossp
    await db.exec(fs.readFileSync(path.join(SQL_DIR, f), "utf8").replace(/create extension[^;]*;/gi, ""));
  }
  const { rows } = await db.query<{ site: string; type: string }>(`select site, type from assets limit 1`);
  for (const c of CASES) {
    await db.query(`insert into assets (id, name, site, type, vg_grade) values ($1, $1, $2, $3, $4)`, [c.id, rows[0].site, rows[0].type, c.vg]);
    if (c.paramOverride) {
      const o = c.paramOverride;
      await db.query(
        `insert into asset_alarm_overrides (asset_id, category, key, warn_limit, crit_limit, warn_penalty, crit_penalty) values ($1,$2,$3,$4,$5,$6,$7)`,
        [c.id, o.category, o.key, o.warn_limit ?? null, o.crit_limit ?? null, o.warn_penalty ?? null, o.crit_penalty ?? null],
      );
    }
    if (c.scoreOverride) {
      const s = c.scoreOverride;
      await db.query(`insert into asset_score_overrides (asset_id, oil_weight, vib_weight) values ($1,$2,$3)`, [c.id, s.oil_weight ?? null, s.vib_weight ?? null]);
    }
    // the insert triggers run compute_health
    if (c.oil) await db.query(`insert into oil_readings (asset_id, period, ${Object.keys(c.oil).join(",")}) values ($1, '2026-10', ${Object.keys(c.oil).map((_, i) => `$${i + 2}`).join(",")})`, [c.id, ...Object.values(c.oil)]);
    if (c.vib) await db.query(`insert into vib_readings (asset_id, period, ${Object.keys(c.vib).join(",")}) values ($1, '2026-10', ${Object.keys(c.vib).map((_, i) => `$${i + 2}`).join(",")})`, [c.id, ...Object.values(c.vib)]);
  }
}, 120_000);

describe("compute_health (SQL) = getDeductionBreakdown (TypeScript)", () => {
  it.each(CASES.map((c) => [c.id, c] as const))("%s", async (_id, c) => {
    const params = (await db.query<AlarmParam>(`select * from alarm_params`)).rows.map((p) => ({
      ...p,
      warn_limit: num(p.warn_limit), crit_limit: num(p.crit_limit), warn_penalty: num(p.warn_penalty), crit_penalty: num(p.crit_penalty),
    }));
    const cfgRow = (await db.query<Record<string, unknown>>(`select * from score_config where id = 1`)).rows[0];
    // the same field-by-field fallback as getAssetAlarmConfig
    const merged = params.map((p) => {
      const o = c.paramOverride && c.paramOverride.category === p.category && c.paramOverride.key === p.key ? c.paramOverride : null;
      return o ? { ...p, warn_limit: o.warn_limit ?? p.warn_limit, crit_limit: o.crit_limit ?? p.crit_limit, warn_penalty: o.warn_penalty ?? p.warn_penalty, crit_penalty: o.crit_penalty ?? p.crit_penalty } : p;
    });
    const cfg: ScoreConfig = {
      oil_weight: c.scoreOverride?.oil_weight ?? Number(cfgRow.oil_weight),
      vib_weight: c.scoreOverride?.vib_weight ?? Number(cfgRow.vib_weight),
      warn_penalty: Number(cfgRow.warn_penalty),
      crit_penalty: Number(cfgRow.crit_penalty),
    };
    const oil = c.oil ? ({ period: "2026-10", cu: null, si: null, iso_code: null, ...Object.fromEntries(OIL.map((k) => [k, c.oil?.[k] ?? null])) } as OilReading) : null;
    const vib = c.vib ? ({ period: "2026-10", ...Object.fromEntries(VIB.map((k) => [k, c.vib?.[k] ?? null])) } as VibReading) : null;

    const ts = getDeductionBreakdown(oil, vib, merged, cfg, c.vg).netScore;
    const sql = (await db.query<{ health: number }>(`select health from assets where id = $1`, [c.id])).rows[0].health;
    expect(Number(sql)).toBe(ts);
  });

  it("the cases really exercise the formula (not all 100)", async () => {
    const { rows } = await db.query<{ n: number }>(`select count(distinct health)::int as n from assets where id like 'T-%'`);
    expect(rows[0].n).toBeGreaterThan(3);
  });
});
