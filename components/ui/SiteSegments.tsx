"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SiteSegment {
  key: string; // "" = all (the first item, set apart by a divider)
  label: string;
  count?: number;
  href: string;
  icon?: ReactNode;
}

// A filter row (plants on the Dashboard / Asset DB, statuses on the Asset DB) as one segmented bar.
// The highlight slides to the picked item at once, before the page reloads with the new query —
// this component stays mounted across that navigation.
export function SiteSegments({ items, active, label = "กรองตามโรงงาน", className = "mb-3" }: {
  items: SiteSegment[];
  active: string;
  label?: string;
  className?: string;
}) {
  const [current, setCurrent] = useState(active);
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const refs = useRef(new Map<string, HTMLAnchorElement>());

  // A filter changed some other way (back button, a chart click): follow the URL.
  useLayoutEffect(() => setCurrent(active), [active]);
  useLayoutEffect(() => {
    const el = refs.current.get(current);
    if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
  }, [current]);

  return (
    <nav
      aria-label={label}
      // phones: one row that scrolls sideways, its edges fading out
      className={cn("max-w-full overflow-x-auto max-sm:[mask-image:linear-gradient(90deg,transparent,#000_14px,#000_calc(100%-14px),transparent)]", className)}
    >
      <div className="relative inline-flex items-stretch rounded-xl border border-border bg-bg2 p-1">
        {box && (
          <span
            aria-hidden
            className="absolute bottom-1 top-1 rounded-lg bg-gradient-to-b from-cyan to-cyan-dark shadow-[0_0_16px_rgba(0,102,204,0.35)] transition-[left,width] duration-300 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
            style={{ left: box.left, width: box.width }}
          />
        )}
        {items.map((it, i) => {
          const on = it.key === current;
          return (
            <div key={it.key || "all"} className="flex items-stretch">
              <Link
                ref={(el) => { if (el) refs.current.set(it.key, el); }}
                href={it.href}
                onClick={() => setCurrent(it.key)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "tap relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] font-semibold transition duration-150",
                  on ? "text-white" : "text-t2 hover:-translate-y-px hover:text-t1",
                )}
              >
                {it.icon}
                {it.label}
                {it.count != null && <span className={cn("font-mono text-[13px] tabular-nums", on ? "text-white/80" : "text-t3")}>{it.count}</span>}
              </Link>
              {/* "All sites" stands apart from the plants */}
              {i === 0 && <span aria-hidden className="mx-1 my-1.5 w-px bg-border" />}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
