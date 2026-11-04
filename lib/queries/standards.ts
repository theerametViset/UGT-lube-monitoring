import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoStandards } from "@/lib/demo-data";
import type { Standard, StandardCategory } from "@/lib/types";

const COLS =
  "id,category,title,subtitle,description,full_text,tags,version,updated_at,updated_by,related_params,asset_types,related_standard_ids";

async function demo(): Promise<Standard[]> {
  return getDemoStandards();
}

export async function listStandards(opts: {
  category?: StandardCategory | "";
  q?: string;
}): Promise<Standard[]> {
  const q = (opts.q ?? "").trim().toLowerCase();
  if (isDemoMode()) {
    const all = await demo();
    return all.filter((s) => {
      if (opts.category && s.category !== opts.category) return false;
      if (q) {
        const hay = `${s.title} ${s.subtitle ?? ""} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  const supabase = createClient();
  let query = supabase.from("standards").select(COLS);
  if (opts.category) query = query.eq("category", opts.category);
  const { data, error } = await query.order("title");
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Standard[];
  if (!q) return all;
  return all.filter((s) => {
    const hay = `${s.title} ${s.subtitle ?? ""} ${s.description ?? ""} ${(s.tags ?? []).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });
}

export async function getStandard(id: string): Promise<Standard | null> {
  if (isDemoMode()) {
    return (await demo()).find((s) => s.id === id) ?? null;
  }
  const supabase = createClient();
  const { data, error } = await supabase.from("standards").select(COLS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Standard | null) ?? null;
}

// Standards whose related_params overlap any of `paramKeys`, plus standards that
// apply to `assetType`. Used by drill-down / alarm config to link references.
export async function listStandardsRelated(
  paramKeys: string[],
  assetType?: string,
): Promise<Standard[]> {
  const keys = paramKeys.filter(Boolean);
  if (isDemoMode()) {
    const all = await demo();
    return all.filter(
      (s) =>
        (s.related_params ?? []).some((k) => keys.includes(k)) ||
        (assetType && (s.asset_types ?? []).includes(assetType)),
    );
  }
  const supabase = createClient();
  let query = supabase.from("standards").select(COLS);
  if (keys.length) query = query.or(`related_params.ov.{${keys.join(",")}}`);
  const { data, error } = await query.order("title");
  if (error) throw new Error(error.message);
  const byType = assetType
    ? await supabase.from("standards").select(COLS).contains("asset_types", [assetType])
    : null;
  if (byType?.error) throw new Error(byType.error.message);
  const seen = new Set<string>();
  const out: Standard[] = [];
  for (const s of [...(data ?? []), ...(byType?.data ?? [])] as Standard[]) {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

// Map of param key -> related standards (for the Alarm Config page).
export async function getStandardsByParam(paramKeys: string[]): Promise<Record<string, Standard[]>> {
  const related = await listStandardsRelated(paramKeys);
  const map: Record<string, Standard[]> = {};
  for (const s of related) {
    for (const k of s.related_params ?? []) {
      (map[k] ??= []).push(s);
    }
  }
  return map;
}
