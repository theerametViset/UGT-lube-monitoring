import Link from "next/link";
import { ChartColumn, CircleCheck, ClipboardList, Cog, Factory, OctagonAlert, Shapes, TriangleAlert, Wrench } from "lucide-react";
import { getDashboardData, getAssetsList } from "@/lib/queries/assets";
import { getActionReasons, NO_REASON } from "@/lib/queries/action-reasons";
import { AdviceList } from "@/components/ui/AdviceList";
import { SiteSegments } from "@/components/ui/SiteSegments";
import type { Asset, AssetStatus } from "@/lib/types";
import {
  Card,
  KpiCard,
  HealthBadge,
  ButtonLink } from "@/components/ui/primitives";
import { SiteReliabilityChart } from "@/components/charts/SiteReliabilityChart";
import { RiskConcentrationChart } from "@/components/charts/RiskConcentrationChart";
import { OilLevel } from "@/components/charts/OilLevel";
import { formatNumber } from "@/lib/utils";
import { formatPeriodTh } from "@/lib/format";
import { getLatestLabPeriods } from "@/lib/queries/readings";
import { healthColor, statusLabelTh } from "@/lib/scoring/health";
import { readableText } from "@/lib/color";

// A KPI card that is a link; `active` marks the status currently filtering the table.
function KpiLink({ href, active = false, title, children }: { href: string; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "true" : undefined}
      className={`block rounded-[14px] transition-opacity ${active ? "ring-2 ring-cyan" : "hover:opacity-90"}`}
    >
      {children}
    </Link>
  );
}

export const dynamic = "force-dynamic";

const FLEET_PAGE = 10; // rows per page of the fleet table — the whole page shows, no scroll box

interface PageProps {
  searchParams: {
    site?: string;
    status?: string;
    q?: string;
    page?: string;
  };
}

function buildHref(
  base: { site: string; status: string; q: string },
  overrides: Partial<{ site: string; status: string; q: string; page: number }>,
) {
  const site = overrides.site !== undefined ? overrides.site : base.site;
  const status =
    overrides.status !== undefined ? overrides.status : base.status;
  const q = overrides.q !== undefined ? overrides.q : base.q;
  const page = overrides.page;
  const params = new URLSearchParams();
  if (site) params.set("site", site);
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const site = searchParams.site ?? "";
  const status = (searchParams.status ?? "") as AssetStatus | "";
  const q = searchParams.q ?? "";
  const page = Number(searchParams.page ?? "1") || 1;
  const base = { site, status, q };

  const [{ data, reference }, table] = await Promise.all([
    getDashboardData(site),
    // worst first: the machines that need attention lead the table
    getAssetsList({ site, q, status, sort: "health_asc", page, pageSize: FLEET_PAGE }),
  ]);
  const [reasons, lab] = await Promise.all([
    getActionReasons(data.topCritical),
    // the real latest lab month — assets.last_update is the month the machine was added
    getLatestLabPeriods([...new Set([...data.topCritical, ...table.rows].map((a) => a.id))]),
  ]);
  const labText = (id: string) => (lab[id] ? formatPeriodTh(lab[id]) : "—");

  const topType = data.perType[0];
  const riskiest = topType && topType.critical > 0;
  const scopeLabel = site || "ทุกโรงงาน";
  // Toggle: clicking the active status clears it. Jumps to the table it filters.
  const statusHref = (st: AssetStatus) => `${buildHref(base, { status: status === st ? "" : st, page: 1 })}#fleet`;

  return (
    <div id="main-content" className="fade min-w-0">
      {/* Site filter: one segmented bar */}
      <SiteSegments
        active={site}
        items={[
          { key: "", label: "ทุกโรงงาน (All Sites)", count: data.perSite.reduce((n, p) => n + p.total, 0), href: buildHref(base, { site: "" }), icon: <ChartColumn className="h-3.5 w-3.5" aria-hidden /> },
          ...reference.sites.map((s) => ({
            key: s.code,
            label: s.code,
            count: data.perSite.find((p) => p.code === s.code)?.total ?? 0,
            href: buildHref(base, { site: s.code }),
          })),
        ]}
      />

      {/* KPI grid — each status card filters the fleet table (click again to clear);
          the total card opens the Asset Database sorted worst-first. */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <KpiLink
          href={`/assets?${new URLSearchParams({ ...(site ? { site } : {}), sort: "health_asc" })}`}
          title="เปิดฐานข้อมูลเครื่องจักร เรียงจากคะแนนต่ำสุด"
        >
          <KpiCard
            tone="cyan"
            label="เครื่องจักรทั้งหมด (Total assets)"
            value={formatNumber(data.kpis.total)}
            note={<span className="text-cyan">คะแนนสุขภาพเฉลี่ย {data.kpis.avgHealth}</span>}
            icon={<Cog />}
          />
        </KpiLink>
        {/* Colour follows urgency: only a status that has machines in it is coloured,
            and a critical machine lights the whole card; "ปกติ" stays quiet. */}
        <KpiLink href={statusHref("Critical")} active={status === "Critical"} title="กรองตารางเฉพาะเครื่องวิกฤต">
          <KpiCard
            tone="red"
            label="วิกฤต (Critical)"
            className={data.kpis.critical > 0 ? "kpi-alarm border-red/50 bg-red/[0.06]" : undefined}
            value={<span className={data.kpis.critical > 0 ? "text-red" : undefined}>{formatNumber(data.kpis.critical)}</span>}
            note={data.kpis.critical > 0
              ? <span className="inline-flex items-center gap-1 text-red"><TriangleAlert className="h-3.5 w-3.5" aria-hidden />ต้องดำเนินการด่วน</span>
              : "ไม่มีเครื่องวิกฤต"}
            icon={<OctagonAlert />}
            // A shallow pool of red oil, waving, under the glowing border.
            backdrop={data.kpis.critical > 0 ? <OilLevel health={8} color="#ef4444" /> : undefined}
          />
        </KpiLink>
        <KpiLink href={statusHref("Warning")} active={status === "Warning"} title="กรองตารางเฉพาะเครื่องเฝ้าระวัง">
          <KpiCard
            tone="yellow"
            label="เฝ้าระวัง (Warning)"
            value={<span className={data.kpis.warning > 0 ? "text-yellow" : undefined}>{formatNumber(data.kpis.warning)}</span>}
            note="ติดตามใกล้ชิด"
            icon={<TriangleAlert />}
            // Low, dirty oil: worth watching, not yet urgent.
            backdrop={data.kpis.warning > 0 ? <OilLevel health={30} color="#f59e0b" sediment /> : undefined}
          />
        </KpiLink>
        <KpiLink href={statusHref("Healthy")} active={status === "Healthy"} title="กรองตารางเฉพาะเครื่องปกติ">
          <KpiCard
            tone="green"
            label="ปกติ (Healthy)"
            value={formatNumber(data.kpis.healthy)}
            note="อยู่ในเกณฑ์ปกติ"
            icon={<CircleCheck />}
            // Oil level = share of the fleet that is healthy.
            backdrop={<OilLevel health={data.kpis.total ? (data.kpis.healthy / data.kpis.total) * 100 : 0} />}
          />
        </KpiLink>
      </div>

      {/* What needs action — reasons + next step for each machine in the feed */}
      <Card className="mb-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex flex-wrap items-center gap-x-2 font-sans text-[18px] max-sm:text-[16px] font-semibold text-t1">
            <Wrench className="h-4 w-4 text-red" aria-hidden />
            <span className="whitespace-nowrap">เครื่องที่ต้องดำเนินการ</span> <span className="text-[13px] font-medium text-t3">(Action Required)</span>
            <span className="font-mono text-[13px] text-t3">({data.topCritical.length})</span>
          </h2>
          <span className="text-[13px] text-t3">เรียงจากคะแนนต่ำสุดใน{scopeLabel} พร้อมค่าที่ทำให้เสียคะแนนมากที่สุด</span>
        </div>
        {data.topCritical.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-[14px] text-t2">
            <CircleCheck className="h-4 w-4 text-green" aria-hidden />
            ทุกเครื่องใน{scopeLabel}อยู่ในเกณฑ์ปกติ ไม่มีเครื่องที่ต้องจัดการตอนนี้
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {data.topCritical.map((a, i) => {
              const why = reasons[a.id] ?? NO_REASON;
              return (
                <li
                  key={a.id}
                  // The coloured score tile carries the severity, so rows scan top to bottom at a glance.
                  className="grid grid-cols-[1.25rem_1fr] items-center gap-x-3 gap-y-1.5 rounded-lg px-1.5 py-3 transition-colors hover:bg-cyan/[0.03] md:grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_minmax(0,2fr)_auto]"
                >
                  <span className="text-center font-mono text-[13px] text-t3">{i + 1}</span>
                  <HealthBadge score={a.health} size="tile" />
                  <div className="col-start-2 min-w-0 md:col-start-auto">
                    <Link href={`/assets/${encodeURIComponent(a.id)}`} className="font-mono text-[14px] font-semibold text-cyan hover:underline">{a.id}</Link>
                    <div className="truncate text-[14px] text-t1">{a.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-t3">
                      <span className="inline-flex items-center gap-1"><Factory className="h-3 w-3" aria-hidden />{a.site}</span>
                      <span>{a.type}</span>
                      <span>ผลแล็บ {labText(a.id)}</span>
                    </div>
                  </div>
                  <div className="col-start-2 md:col-start-auto">
                    <AdviceList reason={why} compact />
                  </div>
                  <div className="col-start-2 flex flex-wrap gap-1.5 md:col-start-auto md:justify-end">
                    <ButtonLink href={`/assets/${encodeURIComponent(a.id)}`} size="xs">ดูรายละเอียด</ButtonLink>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      {/* Where the risk sits: by site and by equipment type */}
      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* min-w-0 + overflow-hidden: the canvas otherwise sizes past its grid track and its right axis spills into the next card */}
        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-center gap-x-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold [overflow-wrap:anywhere]">
                <ChartColumn className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">สุขภาพเครื่องจักรรายโรงงาน</span>
                <span className="text-[13px] font-medium text-t3">(Health by Site)</span>
              </h2>
              <div className="text-[14px] text-t2">
                ตัวเลขใต้ชื่อโรงงาน = Health Score เฉลี่ยของทุกเครื่องในโรงงาน · กดแท่งเพื่อกรอง
              </div>
            </div>
          </div>
          {/* fills the card so it matches the feed's height — no blank strip under the chart */}
          <SiteReliabilityChart
            modeToggle
            data={data.siteReliability}
            className="flex-1"
            // clicking the selected site again clears the filter, like the site pills
            siteHrefs={Object.fromEntries(
              data.siteReliability.map((s) => [s.code, buildHref(base, { site: site === s.code ? "" : s.code })]),
            )}
          />
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex min-w-0 flex-wrap items-center gap-x-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold [overflow-wrap:anywhere]">
              <Shapes className="h-4 w-4 shrink-0" aria-hidden /><span className="min-w-0">ความเสี่ยงตามประเภทเครื่องจักร</span> <span className="text-[13px] font-medium text-t3">(Risk by Type)</span>
            </h2>
            <span className={`badge ${riskiest ? "badge-crit" : "badge-ok"}`}>
              {riskiest
                ? `เสี่ยงสุด: ${topType.type} มีเครื่องวิกฤต ${topType.critical} เครื่อง`
                : <span className="inline-flex items-center gap-1">ไม่มีเครื่องวิกฤต<CircleCheck className="h-3 w-3" aria-hidden /></span>}
            </span>
          </div>
          <div className="mb-2.5 text-[14px] text-t2">
            เรียงจากประเภทที่มีเครื่องวิกฤตมากที่สุด
          </div>
          <RiskConcentrationChart data={data.perType} />
        </Card>

      </div>

      <Card id="fleet" className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 font-sans text-[18px] max-sm:text-[16px] font-semibold">
              <ClipboardList className="h-4 w-4" aria-hidden />ตารางสรุปกองเครื่องจักร
            </h2>
            <form method="get" action="/dashboard#fleet" className="flex flex-wrap gap-1.5">
              <input type="hidden" name="site" value={site} />
              <label className="sr-only" htmlFor="search-q">ค้นหาเครื่องจักร</label>
              <input
                id="search-q"
                name="q"
                defaultValue={q}
                placeholder="ค้นหารหัสหรือชื่อเครื่อง…"
                className="w-[190px] rounded-pill border border-border bg-bg2 px-2 py-1 text-[14px] outline-none focus:border-cyan"
              />
              <label className="sr-only" htmlFor="search-status">สถานะ</label>
              <select
                id="search-status"
                name="status"
                defaultValue={status}
                className="rounded border border-border bg-bg2 px-2 py-1 text-[14px] outline-none"
              >
                <option value="">ทุกสถานะ</option>
                <option value="Critical">วิกฤต</option>
                <option value="Warning">เฝ้าระวัง</option>
                <option value="Healthy">ปกติ</option>
              </select>
              <button
                type="submit"
                className="rounded-pill bg-gradient-to-b from-cyan to-cyan-dark text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_rgba(0,102,204,0.28)] hover:brightness-110 px-2.5 py-1 text-[14px] font-semibold transition active:scale-95"
              >
                ค้นหา
              </button>
            </form>
          </div>

          {/* relative: contains the absolutely-positioned row links; x-scroll only on narrow screens */}
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-black/[0.015]">
                  <th scope="col" className="px-2.5 py-2 text-[13px] font-semibold text-t3">รหัส</th>
                  <th scope="col" className="hidden px-2.5 py-2 text-[13px] font-semibold text-t3 md:table-cell">ชื่อเครื่อง</th>
                  <th scope="col" className="hidden px-2.5 py-2 text-[13px] font-semibold text-t3 md:table-cell">โรงงาน</th>
                  <th scope="col" className="hidden px-2.5 py-2 text-[13px] font-semibold text-t3 md:table-cell">ประเภท</th>
                  <th scope="col" className="px-2.5 py-2 text-[13px] font-semibold text-t3">คะแนน</th>
                  <th scope="col" className="hidden px-2.5 py-2 text-[13px] font-semibold text-t3 md:table-cell">ผลแล็บล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2.5 py-3.5 text-center text-t3">
                      ไม่พบเครื่องที่ตรงกับเงื่อนไข
                    </td>
                  </tr>
                ) : (
                  table.rows.map((a) => (
                    // the id link stretches over the whole row: one link per row, the row is the click target
                    <tr key={a.id} className="relative border-b border-black/[0.025] transition-colors hover:bg-cyan/[0.04] focus-within:bg-cyan/[0.04]">
                      <td className="px-2.5 py-2 align-top font-mono text-[14px] font-semibold md:align-middle">
                        <Link href={`/assets/${encodeURIComponent(a.id)}`} className="whitespace-nowrap text-cyan after:absolute after:inset-0 after:content-[''] hover:underline">{a.id}</Link>
                        {/* phone: name, plant and type stack under the id instead of their own columns */}
                        <div className="font-sans text-[13px] font-medium text-t1 md:hidden">{a.name}</div>
                        <div className="font-sans text-[12px] font-normal text-t3 md:hidden">{a.site} · {a.type}</div>
                      </td>
                      <td className="hidden px-2.5 py-2 text-[14px] font-medium md:table-cell">{a.name}</td>
                      <td className="hidden px-2.5 py-2 text-[14px] text-t2 md:table-cell">{a.site}</td>
                      <td className="hidden px-2.5 py-2 text-[14px] text-t2 md:table-cell">{a.type}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 align-top text-[14px] md:align-middle">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: healthColor(a.health) }} />
                          <b className="tabular-nums" style={{ color: readableText(healthColor(a.health)) }}>{a.health}</b>
                          <span className="text-[13px] text-t3">{statusLabelTh(a.status)}</span>
                        </span>
                        <div className={`text-[12px] md:hidden ${lab[a.id] ? "text-t2" : "text-t3"}`} title="ผลแล็บล่าสุด">ผลแล็บ {labText(a.id)}</div>
                      </td>
                      <td className={`hidden whitespace-nowrap px-2.5 py-2 text-[13px] md:table-cell ${lab[a.id] ? "text-t2" : "text-t3"}`} title={lab[a.id] ? undefined : "ยังไม่มีผลแล็บ"}>
                        {labText(a.id)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[13px] text-t3">
            <span>
              {table.total > 0
                ? `แสดง ${(table.page - 1) * FLEET_PAGE + 1}–${Math.min(table.total, table.page * FLEET_PAGE)} จาก ${formatNumber(table.total)} เครื่อง · เรียงจากคะแนนต่ำสุด`
                : "ไม่มีรายการ"}
            </span>
            <span className="flex gap-1.5 whitespace-nowrap">
              <ButtonLink href={`${buildHref(base, { page: table.page - 1 })}#fleet`} size="xs" disabled={table.page <= 1}>‹ ก่อนหน้า</ButtonLink>
              <span className="self-center px-1">{table.page}/{table.pages}</span>
              <ButtonLink href={`${buildHref(base, { page: table.page + 1 })}#fleet`} size="xs" disabled={table.page>= table.pages}>ถัดไป ›</ButtonLink>
            </span>
          </div>
        </Card>

    </div>
  );
}
