// Sampling date (as text from a lab Excel) → reading period "YYYY-MM".
// Returns null when the month can't be read with confidence, so callers flag the
// row instead of guessing a month (the old code silently fell back to 2026-06).

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
  "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
};

export function isPeriod(s: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

interface ParsedPeriod {
  period: string;
  /** Both numbers could be the month (e.g. 03/04/2026); day/month order was assumed. */
  ambiguous: boolean;
}

function year(y: number): number | null {
  // 2-digit years: 00-49 are CE (26 → 2026), 50-99 are Buddhist era (69 → 2569 → 2026)
  if (y < 100) y += y >= 50 ? 2500 : 2000;
  if (y > 2400) y -= 543; // Buddhist era (2569 → 2026)
  return y >= 2000 && y <= 2100 ? y : null;
}

function out(y: number | null, m: number, ambiguous = false): ParsedPeriod | null {
  if (y == null || !Number.isInteger(m) || m < 1 || m > 12) return null;
  const period = `${y}-${String(m).padStart(2, "0")}`;
  return isFuturePeriod(period) ? null : { period, ambiguous };
}

// A sample can't come from the future: a mistyped year (2062) would otherwise stay
// the asset's "latest" reading for good. One month of slack covers time zones.
export function isFuturePeriod(period: string): boolean {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return period > `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

export function parseSamplingPeriod(raw: string | null | undefined): ParsedPeriod | null {
  const s = String(raw ?? "").trim();
  if (!s || s === "-") return null;

  // Excel serial day number (cell exported without its date format)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return out(year(d.getUTCFullYear()), d.getUTCMonth() + 1);
  }

  // Month written as a word: 15-Jun-26, Jun 2026, 15 มิ.ย. 2569
  // Drop a time first ("09:05", "10.20 น."): "15-Jun-26 09:05" must not read "05" as the year.
  const t = s.replace(/(?<![\d.])\d{1,2}[:.]\d{2}(?:[:.]\d{2})?(?!\d)(?:\s*น\.)?/g, " ");
  const lower = t.toLowerCase();
  for (const [name, m] of Object.entries(MONTHS)) {
    const at = lower.indexOf(name);
    if (at < 0) continue;
    // a 4-digit year wins over the day ("Jun 15, 2026" is 2026, not 2015); with
    // 2-digit years the year comes last ("Jun 15, 26" → 2026, "15-Jun-26" → 2026)
    const nums = t.slice(at + name.length).match(/\d+/g) ?? [];
    // "2026-Jun-15": the year can sit before the month — a 4-digit number there beats the day after it
    const yearBefore = t.slice(0, at).match(/\d{4}/)?.[0];
    const ys = nums.find((x) => x.length === 4) ?? yearBefore ?? nums[nums.length - 1];
    // "Jun 15" / "Jun 26": one 2-digit number and no day before the month — a day or a
    // year? Read it as a year but flag it, so the user confirms the month.
    const unsure = ys?.length !== 4 && nums.length === 1 && !/\d/.test(t.slice(0, at));
    return ys ? out(year(Number(ys)), m, unsure) : null;
  }

  const n = s.match(/(\d{1,4})[/\-.](\d{1,4})(?:[/\-.](\d{1,4}))?/);
  if (!n) return null;
  const a = Number(n[1]), b = Number(n[2]), c = n[3] != null ? Number(n[3]) : null;

  if (n[1].length === 4) return out(year(a), b); // 2026-06-15 / 2026-06
  if (c == null) return n[2].length >= 2 && b > 12 ? out(year(b), a) : null; // 06/2026 ("15/06" alone has no year)
  if (n[2].length > 2) return null;
  if (a > 12 && b <= 12) return out(year(c), b); // 15/06/26 → day/month
  if (b > 12 && a <= 12) return out(year(c), a); // 6/15/26 → month/day (Excel US format)
  return out(year(c), b, a !== b); // 03/04/2026: Thai labs write day/month
}
