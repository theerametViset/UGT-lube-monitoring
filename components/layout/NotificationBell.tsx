"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Asset } from "@/lib/types";

export interface NotifItem {
  asset: Asset;
  level: "crit" | "warn";
}

const STORAGE_KEY = "ugt-notif-dismissed";

// Dismissed = { [assetId]: healthAtDismissTime }. If the asset's health later
// changes (new reading moved the score), it's treated as a new occurrence and
// resurfaces automatically instead of staying hidden forever.
function loadDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveDismissed(d: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

// criticalCount / warningCount: fleet totals — the list itself only holds the worst few.
export function NotificationBell({ items, criticalCount, warningCount }: { items: NotifItem[]; criticalCount: number; warningCount: number }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(loadDismissed());
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const visible = items.filter((it) => dismissed[it.asset.id] !== it.asset.health);

  function dismiss(assetId: string, health: number) {
    setDismissed((prev) => {
      const next = { ...prev, [assetId]: health };
      saveDismissed(next);
      return next;
    });
  }

  function dismissAll() {
    setDismissed((prev) => {
      const next = { ...prev };
      for (const it of visible) next[it.asset.id] = it.asset.health;
      saveDismissed(next);
      return next;
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-7 w-7 items-center justify-center rounded-md border border-border text-[15px] text-t2"
        aria-label="การแจ้งเตือน"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {visible.length > 0 && (
          <span className="absolute -right-1 -top-1 h-[7px] w-[7px] rounded-full border-[1.5px] border-bg bg-red" />
        )}
      </button>
      {open && (
        <div className="follow-theme absolute right-0 top-9 z-[500] flex max-h-[420px] w-[360px] max-w-[calc(100vw-24px)] flex-col rounded-xl border border-border bg-bg3 text-t1 shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[14px] font-bold text-t1">
            <span className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" aria-hidden />การแจ้งเตือนล่าสุด
              {criticalCount + warningCount > 0 && (
                <span className="text-[12px] font-medium text-t3">
                  {criticalCount > 0 && <>วิกฤต {criticalCount} · </>}เฝ้าระวัง {warningCount}
                </span>
              )}
            </span>
            {visible.length > 0 && (
              <button onClick={dismissAll} className="text-[13px] font-medium text-t3 hover:text-cyan">
                ปิดทั้งหมด
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="px-5 py-5 text-center text-[13px] text-t3">
              ไม่มีการแจ้งเตือนใหม่
            </div>
          ) : (
            visible.map(({ asset, level }) => {
              const color = level === "crit" ? "#ef4444" : "#f59e0b";
              return (
                <div
                  key={asset.id}
                  className="flex items-start gap-2 border-b border-black/[0.04] px-3 py-2 transition hover:bg-cyan/5"
                >
                  <Link href={`/assets/${asset.id}`} className="flex flex-1 items-start gap-2 min-w-0">
                    <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-t1" title={asset.name}>
                        {asset.name}
                      </div>
                      <div className="truncate text-[13px] text-t3">
                        {asset.id} · {asset.site} · Health {asset.health}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => dismiss(asset.id, asset.health)}
                    aria-label={`ปิดการแจ้งเตือน ${asset.name}`}
                    className="shrink-0 rounded px-1 text-t3 hover:text-t1"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
          </div>
          <div className="flex justify-between gap-2 border-t border-border px-3 py-2 text-[13px] font-medium">
            <Link href="/dashboard?status=Critical" onClick={() => setOpen(false)} className="text-red hover:underline">
              ดูเครื่องวิกฤตทั้งหมด →
            </Link>
            <Link href="/dashboard?status=Warning" onClick={() => setOpen(false)} className="text-yellow hover:underline">
              ดูเครื่องเฝ้าระวังทั้งหมด →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
