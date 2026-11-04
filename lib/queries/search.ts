import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoAssets } from "@/lib/demo-data";

export interface SearchResult {
  type: "asset" | "standard";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  health?: number;
}

// `col.ilike."%text%"` for each column, for supabase .or(). The value is double-quoted
// so ( ) , in IDs like "31-A02 (Gear Box)" are plain text instead of filter syntax
// (unquoted they broke the filter and the page); LIKE wildcards are escaped first.
export function ilikeAny(cols: string[], text: string): string {
  const v = text.replace(/[\\%_]/g, "\\$&").replace(/["\\]/g, "\\$&");
  return cols.map((c) => `${c}.ilike."%${v}%"`).join(",");
}

export async function globalSearch(q: string): Promise<SearchResult[]> {
  const query = q.trim().toLowerCase().slice(0, 100);
  if (!query) return [];

  if (isDemoMode()) {
    const assets = getDemoAssets()
      .filter((a) => `${a.id} ${a.name} ${a.type} ${a.site}`.toLowerCase().includes(query))
      .slice(0, 8)
      .map((a) => ({
        type: "asset" as const,
        id: a.id,
        title: a.name,
        subtitle: `${a.id} · ${a.type} · ${a.site} · ${a.health}%`,
        href: `/assets/${a.id}`,
        health: a.health,
      }));
    return assets;
  }

  const supabase = createClient();
  const assetRes = await supabase.from("assets").select("id,name,type,site,health").or(ilikeAny(["id", "name"], query)).limit(8);

  const assets: SearchResult[] = (assetRes.data ?? []).map((a) => ({
    type: "asset",
    id: a.id,
    title: a.name,
    subtitle: `${a.id} · ${a.type} · ${a.site} · ${a.health}%`,
    href: `/assets/${a.id}`,
    health: a.health,
  }));
  return assets;
}
