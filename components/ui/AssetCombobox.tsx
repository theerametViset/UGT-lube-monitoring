"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";

const MAX_RESULTS = 50;

// Searchable machine picker — type part of the ID or name, pick with the
// mouse or ↑ ↓ Enter. Built for fleets far too large for a plain <select>.
export function AssetCombobox({
  assets,
  value,
  onChange,
  placeholder = "ค้นหารหัสหรือชื่อเครื่องจักร...",
  ariaLabel,
  className = "",
}: {
  assets: { id: string; name: string; site?: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const selected = assets.find((a) => a.id === value) ?? null;

  const matches = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = ql ? assets.filter((a) => `${a.id} ${a.name}`.toLowerCase().includes(ql)) : assets;
    return list.slice(0, MAX_RESULTS);
  }, [assets, q]);
  const total = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ql ? assets.filter((a) => `${a.id} ${a.name}`.toLowerCase().includes(ql)).length : assets.length;
  }, [assets, q]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQ("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-t3" aria-hidden />
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        value={open ? q : selected ? `${selected.id} · ${selected.name}` : ""}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setActive(0); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-border bg-bg2 py-1.5 pl-8 pr-14 text-[14px] outline-none focus:border-cyan"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-t3">
        {selected && !open && (
          <button type="button" aria-label="ล้างการเลือก" onClick={() => pick("")} className="rounded p-0.5 hover:text-t1">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-[280px] w-full overflow-y-auto rounded-lg border border-border bg-bg2 py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-[13px] text-t3">ไม่พบเครื่องจักร</li>
          ) : (
            matches.map((a, i) => (
              <li
                key={a.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={a.id === value}
                onMouseDown={(e) => { e.preventDefault(); pick(a.id); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[14px] ${i === active ? "bg-cyan/10" : ""}`}
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono font-semibold text-cyan">{a.id}</span> <span className="text-t2">{a.name}</span>
                </span>
                {a.site && <span className="flex-shrink-0 font-mono text-[13px] text-t3">{a.site}</span>}
              </li>
            ))
          )}
          {total > matches.length && (
            <li className="border-t border-border px-3 py-1.5 text-[13px] text-t3">แสดง {matches.length} จาก {total} รายการ — พิมพ์เพิ่มเพื่อค้นหาให้แคบลง</li>
          )}
        </ul>
      )}
    </div>
  );
}
