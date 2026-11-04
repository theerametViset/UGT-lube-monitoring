"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Settings, BookOpen, type LucideIcon } from "lucide-react";
import { HealthBadge } from "@/components/ui/primitives";

const TYPE_ICON: Record<"asset" | "standard", LucideIcon> = {
  asset: Settings,
  standard: BookOpen,
};

interface SearchResult {
  type: "asset" | "standard";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  health?: number;
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const r = await res.json();
        if (active) {
          setResults(r.results ?? []);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-1.5 rounded-md border border-border bg-bg2 px-2 py-1 text-[13px] text-t3 transition hover:border-cyan"
        title="ค้นหา (Ctrl+K)"
      >
        <Search className="h-3.5 w-3.5" aria-hidden /> <span className="hidden sm:inline">ค้นหา...</span>
        <kbd className="hidden rounded bg-black/5 px-1 text-[14px] sm:inline">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="follow-theme relative w-[90%] max-w-lg overflow-hidden rounded-xl border border-border bg-bg3 text-t1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-t3" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเครื่องจักร..."
            className="flex-1 bg-transparent text-[15px] text-t1 outline-none placeholder-t3"
            autoFocus
          />
          {loading && <span className="text-[13px] text-t3">...</span>}
          <button aria-label="ESC" onClick={() => setOpen(false)} className="text-[13px] text-t3">ESC</button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && q.trim() ? (
            <div className="px-5 py-4 text-center text-[13px] text-t3">
              {loading ? "กำลังค้นหา..." : `ไม่พบ "${q}"`}
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.type + r.id}
                onClick={() => go(r.href)}
                className="flex w-full items-center gap-2.5 border-b border-black/[0.03] px-3 py-2 text-left transition hover:bg-cyan/[0.05]"
              >
                {(() => { const Icon = TYPE_ICON[r.type] ?? Settings; return <Icon className="h-4 w-4 flex-shrink-0 text-t2" aria-hidden />; })()}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-t1">{r.title}</div>
                  <div className="truncate text-[13px] text-t3">{r.subtitle}</div>
                </div>
                {r.health != null && <HealthBadge score={r.health} />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
