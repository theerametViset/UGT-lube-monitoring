// Matches a machine TAG read from a lab Excel to an asset in the system.
// Exact id → "exact". Same id once case, spaces and - _ . / are ignored
// ("34u02b" ↔ "34-U02-B") and only one asset fits → "normalized" (auto-selected).
// Otherwise up to 3 close ids/names are offered for the user to confirm.

export interface MatchCandidate {
  id: string;
  name: string;
  site: string;
}

export type TagMatch =
  | { kind: "exact" | "normalized"; id: string; suggestions: MatchCandidate[] }
  | { kind: "suggest" | "none" | "empty"; id: null; suggestions: MatchCandidate[] };

export function normalizeTag(s: string): string {
  return s.toUpperCase().replace(/[\s\-_./\\]+/g, "");
}

function distance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** 0…1, 1 = same once normalized. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  // one contains the other (lab added a prefix/suffix) — scored by how much is shared
  if (a.includes(b) || b.includes(a)) return 0.75 + 0.2 * (Math.min(a.length, b.length) / Math.max(a.length, b.length));
  return 1 - distance(a, b) / Math.max(a.length, b.length);
}

const SUGGEST_MIN = 0.6;

interface Indexed {
  byId: Map<string, MatchCandidate>;
  byKey: Map<string, MatchCandidate[]>;
  keys: { a: MatchCandidate; id: string; name: string }[];
}

// Normalized once per asset list, not once per Excel row.
const indexes = new WeakMap<MatchCandidate[], Indexed>();

function indexOf(assets: MatchCandidate[]): Indexed {
  let ix = indexes.get(assets);
  if (ix) return ix;
  ix = { byId: new Map(), byKey: new Map(), keys: [] };
  for (const a of assets) {
    ix.byId.set(a.id, a);
    const id = normalizeTag(a.id);
    const list = ix.byKey.get(id);
    if (list) list.push(a);
    else ix.byKey.set(id, [a]);
    ix.keys.push({ a, id, name: normalizeTag(a.name) });
  }
  indexes.set(assets, ix);
  return ix;
}

export function matchTag(tag: string | null | undefined, assets: MatchCandidate[]): TagMatch {
  const raw = String(tag ?? "").trim();
  if (!raw) return { kind: "empty", id: null, suggestions: [] };

  const ix = indexOf(assets);
  const exact = ix.byId.get(raw);
  if (exact) return { kind: "exact", id: exact.id, suggestions: [] };

  const key = normalizeTag(raw);
  const same = ix.byKey.get(key) ?? [];
  if (same.length === 1) return { kind: "normalized", id: same[0].id, suggestions: [] };

  const scored = ix.keys
    .map(({ a, id, name }) => ({ a, s: Math.max(similarity(key, id), similarity(key, name) - 0.05) }))
    .filter((x) => x.s >= SUGGEST_MIN)
    .sort((x, y) => y.s - x.s || x.a.id.localeCompare(y.a.id))
    .slice(0, 3)
    .map((x) => x.a);
  // several assets collapse to the same normalized id → never auto-pick, offer them all
  const suggestions = same.length > 1 ? [...same, ...scored.filter((s) => !same.includes(s))].slice(0, 3) : scored;
  return { kind: suggestions.length ? "suggest" : "none", id: null, suggestions };
}
