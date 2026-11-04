"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BiLabel } from "@/components/ui/primitives";
import { NAV_SECTIONS as SECTIONS, type NavItem } from "@/lib/nav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LogoutButton } from "@/components/layout/LogoutButton";
import type { Profile } from "@/lib/types";

const STORAGE_KEY = "sidebar-collapsed";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  demo = false,
  profile,
  permittedKeys = [],
  criticalCount = 0,
  warningCount = 0,
}: {
  demo?: boolean;
  profile: Profile;
  permittedKeys?: string[];
  /** Machines in Critical status, shown as a badge on the Dashboard entry. */
  criticalCount?: number;
  /** Machines in Warning status: the badge shows them (amber) when nothing is Critical. */
  warningCount?: number;
}) {
  const pathname = usePathname();
  const granted = new Set(permittedKeys);

  // Start from the defaults so server and client render the same markup, then
  // apply what this browser remembered.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.filter((s) => s.collapsible).map((s) => [s.id, !!s.defaultCollapsed])),
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
      setCollapsed((c) => ({ ...c, ...saved }));
    } catch {
      /* storage unavailable — keep defaults */
    }
  }, []);
  function toggle(id: string) {
    setCollapsed((c) => {
      const next = { ...c, [id]: !c[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — still toggles for this visit */
      }
      return next;
    });
  }

  return (
    <aside className="on-dark z-[100] bg-[linear-gradient(180deg,rgba(245,158,11,0.07),transparent_45%)] flex w-[184px] max-[760px]:w-[56px] flex-shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-white/10 bg-nav text-white transition-all duration-200">
      <div className="oil-sheen border-b border-white/10 px-2.5 py-3 max-[760px]:px-2 max-[760px]:py-2">
        <div className="flex items-center gap-1.5 max-[760px]:justify-center">
          <div className="flex h-[40px] w-[40px] flex-shrink-0 items-center justify-center rounded-[7px] max-[760px]:h-[30px] max-[760px]:w-[30px]">
            <Image src="/logo.svg" alt="UBE logo" width={40} height={40} unoptimized className="h-full w-full object-contain" priority />
          </div>
          <div className="whitespace-nowrap max-[760px]:hidden">
            <div className="text-[12px] font-bold leading-tight tracking-wide">UGT RELIABILITY</div>
            <div className="text-[12px] font-bold uppercase leading-tight tracking-[0.04em] text-yellow">Lube Monitoring</div>
          </div>
        </div>
      </div>

      <nav aria-label="เมนูหลัก (Main navigation)" className="flex flex-1 flex-col">
      {SECTIONS.map((section) => {
        const items = section.items.filter((item) => !item.perm || granted.has(item.perm));
        if (items.length === 0) return null;
        // A section holding the current page never hides it.
        const hasActive = items.some((i) => isActive(pathname, i.href));
        const folded = !!section.collapsible && !!collapsed[section.id] && !hasActive;
        const listId = `nav-${section.id}`;
        return (
          <div key={section.id} className={cn("pb-1", section.pinBottom && "mt-auto border-t border-white/10")}>
            {section.collapsible ? (
              <button
                type="button"
                onClick={() => toggle(section.id)}
                aria-expanded={!folded}
                aria-controls={listId}
                className="flex w-full items-center justify-between px-3 pb-1 pt-2.5 text-left text-[13px] font-bold text-white/55 transition hover:text-white/85 max-[760px]:hidden"
              >
                <span className="flex items-start gap-1.5">
                  {section.icon && <section.icon className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden />}
                  <BiLabel text={section.title} />
                </span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition", folded && "-rotate-90")} aria-hidden />
              </button>
            ) : (
              <div className="px-3 pb-1 pt-2.5 text-[13px] font-bold text-white/55 max-[760px]:hidden">
                <span><BiLabel text={section.title} /></span>
              </div>
            )}
            {/* In the icon-only rail there are no section headers to unfold with, so show everything. */}
            <div id={listId} className={cn(folded && "hidden max-[760px]:block")}>
              {items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                  badge={item.href === "/dashboard" ? criticalCount || warningCount : 0}
                  warn={criticalCount === 0}
                />
              ))}
            </div>
          </div>
        );
      })}
      </nav>

      {/* Connection status only once a real database is attached. */}
      {!demo && (
        <div className="border-t border-white/10 px-3 py-2 max-[760px]:px-1">
          <div className="flex items-center gap-1.5 max-[760px]:justify-center" role="status" aria-label="System status: Connected">
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-green" />
            <div className="text-[14px] font-semibold text-green max-[760px]:hidden">เชื่อมต่อสำเร็จ (Connected)</div>
          </div>
        </div>
      )}

      {/* User card. data-theme="dark": the buttons' tokens must read on the black sidebar in light mode too. */}
      <div data-theme="dark" className="border-t border-white/10 px-2.5 py-2.5 text-t1 max-[760px]:px-1">
        <div className="flex items-center gap-2 max-[760px]:justify-center">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan text-[13px] font-bold uppercase text-white"
            title={`${profile.full_name ?? profile.role} · ${profile.role}`}
          >
            {(profile.full_name || profile.role).slice(0, 2)}
          </div>
          <div className="min-w-0 max-[760px]:hidden">
            <div className="truncate text-[14px] font-semibold">{profile.full_name || "—"}</div>
            <div className="truncate text-[12px] text-t3">
              {profile.role} · {profile.site_access.length ? profile.site_access.join(", ") : "All Plants"}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-1.5 max-[760px]:flex-col">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}

function NavLink({ item, active, badge = 0, warn = false }: { item: NavItem; active: boolean; badge?: number; warn?: boolean }) {
  const Icon = item.icon;
  const inner = (
    <>
      {/* The count sits on the icon's corner, so it never takes width from the label. */}
      <span className="relative flex-shrink-0">
        <Icon
          className={cn(
            "h-4 w-4 transition max-[760px]:h-[18px] max-[760px]:w-[18px]",
            active ? "text-cyan-dark" : "group-hover:text-cyan-dark",
          )}
          aria-hidden
        />
        {badge > 0 && (
          // #dc2626: white text 4.8:1 (brand red #ef4444 was 3.8:1); amber #f59e0b takes black text
          <span className={cn("absolute -right-2 -top-2 min-w-[16px] rounded-full px-1 text-center text-[10px] font-bold leading-4 ring-2 ring-nav", warn ? "bg-[#f59e0b] text-black" : "bg-[#dc2626] text-white")}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="min-w-0 truncate leading-tight max-[760px]:hidden">{item.label}</span>
    </>
  );
  const base =
    "relative m-[1px] mx-[6px] flex items-center gap-2 rounded-lg px-2 py-[7px] text-[14px] font-medium max-[760px]:mx-auto max-[760px]:w-[40px] max-[760px]:justify-center max-[760px]:p-2";
  if (!item.enabled) {
    return (
      <div aria-label={item.label} aria-disabled="true" title={`${item.label} · ${item.sub}`} className={cn(base, "cursor-not-allowed text-white/25")}>
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={item.href}
      aria-label={badge > 0 ? `${item.label} (${warn ? "เฝ้าระวัง" : "วิกฤต"} ${badge} เครื่อง)` : item.label}
      aria-current={active ? "page" : undefined}
      title={`${item.label} · ${item.sub}`}
      className={cn(
        base,
        "group transition",
        // Selected: white text on a soft fill with a bar on the left edge.
        active
          ? "bg-white/[0.09] text-white before:absolute before:inset-y-1.5 before:left-[-6px] before:w-[3px] before:rounded-r-full before:bg-cyan-dark max-[760px]:before:left-[-8px]"
          : "text-white/75 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {inner}
    </Link>
  );
}
