import { ChevronRight } from "lucide-react";
import type { Standard } from "@/lib/types";
import { parseStandardLines, parseStandardSections, type StandardBlock } from "@/lib/parse/standard-content";
import { readableText } from "@/lib/color";

export { parseStandardLines };

// The "## ข้อมูลเอกสาร" section is shown as the document card, not as body text.
export const DOC_SECTION = "ข้อมูลเอกสาร";

// Structured content body (no card chrome — use inside cards/details): every section but the document card.
export function StandardLines({ fullText }: { fullText: string }) {
  const sections = parseStandardSections(fullText).filter((s) => s.title !== DOC_SECTION);
  return (
    <div className="space-y-4">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <div className="mb-1.5 text-[13px] font-bold text-t3">{s.title}</div>}
          <StandardBlocks blocks={s.blocks} />
        </div>
      ))}
    </div>
  );
}

export function StandardBlocks({ blocks }: { blocks: StandardBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((b, i) =>
        b.kind === "table" ? (
          <StandardTable key={i} rows={b.rows} />
        ) : (
          <div key={i} className="space-y-1">
            {b.heading && <div className="text-[14px] font-semibold text-t1">{b.heading}</div>}
            {b.items.map((item, j) => (
              <div key={j} className="flex items-start gap-1.5 text-[14px] leading-relaxed text-t2">
                <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden />
                <span className="min-w-0">{item}</span>
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

// Header cells named "โซน A…D" get the zone colours (A/B green, C yellow, D red), and so does their column.
const ZONE: Record<string, [string, string]> = {
  A: ["bg-green/15 text-green", "text-green"], B: ["bg-green/[0.06] text-green", "text-green"],
  C: ["bg-yellow/15 text-yellow", "text-yellow"], D: ["bg-red/10 text-red", "text-red"],
};

function StandardTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  const zones = head.map((h) => ZONE[/^โซน ([ABCD])/.exec(h)?.[1] ?? ""]);
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((h, j) => (
              <th key={j} className={`border-b border-border px-2.5 py-1.5 text-left font-semibold ${zones[j]?.[0] ?? "bg-bg3 text-t1"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {r.map((c, j) => (
                <td key={j} className={`px-2.5 py-1.5 tabular-nums ${j === 0 ? "font-medium text-t1" : zones[j] ? `font-semibold ${zones[j][1]}` : "text-t2"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CAT_COLOR: Record<string, string> = {
  TRIBOLOGY: "#8b5cf6",
  VIBRATION: "#0066cc",
  RELIABILITY: "#22c55e",
  ASSET: "#f59e0b",
  CUSTOM: "#7a7a7a",
};

// Professional card for a related standard — title, version, description and
// the actual criteria content (collapsible when `compact`).
export function StandardCard({ standard, compact = true }: { standard: Standard; compact?: boolean }) {
  const hasContent = !!(standard.description || standard.full_text);
  return (
    <details
      className="group rounded-lg border border-border bg-bg3/60 transition hover:border-cyan/30"
      open={!compact}
    >
      <summary className="cursor-pointer list-none px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded px-1 py-0.5 text-[13px] font-extrabold"
            style={{ background: (CAT_COLOR[standard.category] ?? "#7a7a7a") + "1a", color: readableText(CAT_COLOR[standard.category] ?? "#7a7a7a") }}
          >
            {standard.category}
          </span>
          <span className="font-sans text-[14px] font-semibold text-t1">{standard.title}</span>
          {standard.version != null && (
            <span className="rounded bg-black/5 px-1 py-0.5 font-mono text-[13px] text-t3">v{standard.version}</span>
          )}
          <ChevronRight className="ml-auto h-3.5 w-3.5 text-t3 transition-transform group-open:rotate-90" aria-hidden />
        </div>
        {standard.subtitle && (
          <div className="mt-0.5 text-[14px] text-cyan">{standard.subtitle}</div>
        )}
      </summary>
      {hasContent && (
        <div className="space-y-2 border-t border-border px-2.5 py-2">
          {standard.description && (
            <p className="text-[14px] leading-relaxed text-t2">{standard.description}</p>
          )}
          {standard.full_text && (
            <div className="rounded-md border border-cyan/15 bg-cyan/[0.03] p-2">
              <StandardLines fullText={standard.full_text} />
            </div>
          )}
        </div>
      )}
    </details>
  );
}
