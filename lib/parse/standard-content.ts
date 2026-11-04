// Pure parser for a standard's full_text — split into lines, then clauses by ·
//   "Zone A ≤2.3 · B 2.3–4.5 · C 4.5–7.1 · D >7.1 mm/s (15–300 kW)"
//     -> [["Zone A ≤2.3", "B 2.3–4.5", "C 4.5–7.1", "D >7.1 mm/s (15–300 kW)"]]
// Kept in its own module so it can be unit-tested without JSX/React.
export function parseStandardLines(fullText: string): string[][] {
  return fullText
    .split("\n")
    .map((line) =>
      line
        .split("·")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .filter((line) => line.length > 0);
}

// "ประเภท: HH · HL" → heading "ประเภท" + items ["HH", "HL"]; a line without a short "label:" prefix has no heading.
export function splitHeading(items: string[]): { heading: string | null; items: string[] } {
  const m = /^([^:]{2,40}):\s+(.+)$/.exec(items[0] ?? "");
  return m ? { heading: m[1].trim(), items: [m[2], ...items.slice(1)] } : { heading: null, items };
}

export type StandardBlock =
  | { kind: "lines"; heading: string | null; items: string[] }
  | { kind: "table"; rows: string[][] };
export type StandardSection = { title: string | null; blocks: StandardBlock[] };

// full_text with sections and tables:
//   "## ใช้ในงาน UGT" starts a section · consecutive "| a | b |" lines form a table (first row = header)
//   any other line is a "heading: item · item" line as above. Text before the first ## has title null.
export function parseStandardSections(fullText: string): StandardSection[] {
  const sections: StandardSection[] = [{ title: null, blocks: [] }];
  for (const raw of fullText.split("\n")) {
    const line = raw.trim();
    const cur = sections[sections.length - 1];
    if (line.startsWith("## ")) { sections.push({ title: line.slice(3).trim(), blocks: [] }); continue; }
    if (line.startsWith("|")) {
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const last = cur.blocks[cur.blocks.length - 1];
      if (last?.kind === "table") last.rows.push(cells); else cur.blocks.push({ kind: "table", rows: [cells] });
      continue;
    }
    const items = line.split("·").map((s) => s.trim()).filter(Boolean);
    if (items.length) cur.blocks.push({ kind: "lines", ...splitHeading(items) });
  }
  return sections.filter((s) => s.blocks.length > 0);
}
