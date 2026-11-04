import { ilikeAny } from "@/lib/queries/search";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isDemoMode } from "@/lib/env";
import { getDemoAssets, getDemoReference } from "@/lib/demo-data";
import type { Asset, AssetStatus, AssetType, Site } from "@/lib/types";

const PAGE_SIZE = 20;

export interface SiteAgg {
  code: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
  avgHealth: number;
}

export interface TypeAgg {
  type: string;
  abbr: string;
  color: string;
  healthy: number;
  warning: number;
  critical: number;
  total: number;
}

export interface DashboardKpis {
  total: number;
  critical: number;
  warning: number;
  healthy: number;
  avgHealth: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  perSite: SiteAgg[]; // ALL accessible — drives site pills
  siteReliability: SiteAgg[]; // SCOPED — drives the chart
  perType: TypeAgg[]; // SCOPED, sorted riskiest first
  topCritical: Asset[];
  scopedAssets: Asset[]; // SCOPED full list — consumed by exec-summary generation
}

export interface ReferenceData {
  sites: Site[];
  types: AssetType[];
  typeMap: Record<string, { abbr: string; color: string }>;
}

// `supabase` is passed only by the cron route, which has no user session.
export async function getReference(supabase?: SupabaseClient): Promise<ReferenceData> {
  if (isDemoMode()) return getDemoReference();
  supabase ??= createClient();
  const [sitesRes, typesRes] = await Promise.all([
    supabase.from("sites").select("code,name,sort_order").order("sort_order"),
    supabase.from("asset_types").select("name,abbr,color"),
  ]);

  const sites = (sitesRes.data ?? []) as Site[];
  const types = (typesRes.data ?? []) as AssetType[];
  const typeMap: ReferenceData["typeMap"] = {};
  for (const t of types) {
    typeMap[t.name] = { abbr: t.abbr ?? "OT", color: t.color ?? "#94a3b8" };
  }
  return { sites, types, typeMap };
}

function bucketByStatus(assets: Asset[]) {
  let healthy = 0;
  let warning = 0;
  let critical = 0;
  let healthSum = 0;
  for (const a of assets) {
    healthSum += a.health;
    if (a.status === "Critical") critical++;
    else if (a.status === "Warning") warning++;
    else healthy++;
  }
  return {
    healthy,
    warning,
    critical,
    total: assets.length,
    avgHealth: assets.length ? Math.round((healthSum / assets.length) * 10) / 10 : 0,
  };
}

function aggregateBySite(
  assets: Asset[],
  codes: string[],
): SiteAgg[] {
  return codes.map((code) => {
    const inSite = assets.filter((a) => a.site === code);
    const b = bucketByStatus(inSite);
    return { code, ...b };
  });
}

// All data the Dashboard needs in one RLS-scoped pass.
// `scopeSite` = '' (global) | 'NY1' ... — an additional UI filter on top of RLS.
export async function getDashboardData(scopeSite: string, supabase?: SupabaseClient): Promise<{
  data: DashboardData;
  reference: ReferenceData;
}> {
  const reference = await getReference(supabase);

  let all: Asset[];
  if (isDemoMode()) {
    all = getDemoAssets();
  } else {
    const db = supabase ?? createClient();
    all = await fetchAll<Asset>((from, to) =>
      db
        .from("assets")
        .select(
          "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update",
        )
        .order("id")
        .range(from, to),
    );
  }
  const scoped = scopeSite ? all.filter((a) => a.site === scopeSite) : all;
  const siteCodes = reference.sites.map((s) => s.code);

  const kpis = bucketByStatus(scoped);

  // Per-type (scoped), sorted riskiest-first: most critical, then most warning.
  const perType: TypeAgg[] = reference.types
    .map((t) => {
      const inType = scoped.filter((a) => a.type === t.name);
      const b = bucketByStatus(inType);
      return {
        type: t.name,
        abbr: t.abbr ?? "OT",
        color: t.color ?? "#94a3b8",
        ...b,
      };
    })
    .filter((t) => t.total > 0)
    .sort(
      (a, b) => b.critical - a.critical || b.warning - a.warning,
    );

  const topCritical = scoped
    .filter((a) => a.status === "Critical" || a.status === "Warning")
    .sort((a, b) => a.health - b.health)
    .slice(0, 10);

  return {
    data: {
      kpis,
      perSite: aggregateBySite(all, siteCodes),
      siteReliability: aggregateBySite(
        scoped,
        scopeSite ? [scopeSite] : siteCodes,
      ),
      perType,
      topCritical,
      scopedAssets: scoped,
    },
    reference,
  };
}

export interface AssetsListResult {
  rows: Asset[];
  total: number;
  page: number;
  pages: number;
}

const ASSET_FULL =
  "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update";

export async function getAsset(id: string): Promise<Asset | null> {
  if (isDemoMode()) return getDemoAssets().find((a) => a.id === id) ?? null;
  const supabase = createClient();
  const { data } = await supabase
    .from("assets")
    .select(ASSET_FULL)
    .eq("id", id)
    .maybeSingle();
  return (data as Asset | null) ?? null;
}

export interface AssetOption {
  id: string;
  name: string;
  health: number;
  status: AssetStatus;
  site: string;
  type: string;
  vg_grade: number;
}

export async function getAssetOptions(): Promise<AssetOption[]> {
  if (isDemoMode()) {
    return getDemoAssets().map((a) => ({ id: a.id, name: a.name, health: a.health, status: a.status, site: a.site, type: a.type, vg_grade: a.vg_grade }));
  }
  const supabase = createClient();
  return fetchAll<AssetOption>((from, to) =>
    supabase.from("assets").select("id,name,health,status,site,type,vg_grade").order("id").range(from, to),
  );
}

export async function getAssetsList(opts: {
  site?: string;
  q?: string;
  status?: AssetStatus | "";
  sort?: "" | "health_asc";
  page?: number;
}): Promise<AssetsListResult> {
  const site = opts.site ?? "";
  const q = (opts.q ?? "").trim();
  const status = opts.status ?? "";
  const sort = opts.sort ?? "";
  const page = opts.page ?? 1;

  if (isDemoMode()) {
    let all = getDemoAssets();
    if (site) all = all.filter((a) => a.site === site);
    if (status) all = all.filter((a) => a.status === status);
    if (q) {
      const ql = q.toLowerCase();
      all = all.filter((a) => `${a.id} ${a.name}`.toLowerCase().includes(ql));
    }
    if (sort === "health_asc") all = [...all].sort((a, b) => a.health - b.health);
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const p = Math.min(Math.max(1, page), pages);
    const start = (p - 1) * PAGE_SIZE;
    return { rows: all.slice(start, start + PAGE_SIZE), total, page: p, pages };
  }

  const supabase = createClient();
  let query = supabase
    .from("assets")
    .select(
      "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update",
      { count: "exact" },
    );
  if (site) query = query.eq("site", site);
  if (status) query = query.eq("status", status);
  if (q) query = query.or(ilikeAny(["id", "name"], q));
  query = query.order(sort === "health_asc" ? "health" : "id", {
    ascending: sort === "health_asc",
  });
  const start = (page - 1) * PAGE_SIZE;
  query = query.range(start, start + PAGE_SIZE - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return {
    rows: (data ?? []) as Asset[],
    total,
    page: Math.min(Math.max(1, page), pages),
    pages,
  };
}

const FLEET_COLS =
  "id,name,type,site,health,status,install_date,motor_kw,rpm,vg_grade,oil_brand,oil_qty_l,oil_change_months,oil_sample_months,last_update";

// The whole fleet (RLS-scoped), read once per request: the Asset DB's site counts and
// data checks both need it, and used to read it separately.
export const getAllAssets = cache(async (): Promise<Asset[]> => {
  if (isDemoMode()) return getDemoAssets();
  const supabase = createClient();
  return fetchAll<Asset>((from, to) => supabase.from("assets").select(FLEET_COLS).order("id").range(from, to));
});

export async function getSiteCounts(): Promise<Record<string, number>> {
  if (isDemoMode()) {
    const assets = getDemoAssets();
    const counts: Record<string, number> = {};
    for (const a of assets) {
      counts[a.site] = (counts[a.site] || 0) + 1;
    }
    return counts;
  }
  const data = await getAllAssets();
  const counts: Record<string, number> = {};
  for (const a of data) {
    counts[a.site] = (counts[a.site] || 0) + 1;
  }
  return counts;
}
