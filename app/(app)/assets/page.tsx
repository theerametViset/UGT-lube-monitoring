import Link from "next/link";
import { redirect } from "next/navigation";
import { getAssetsList, getReference, getSiteCounts } from "@/lib/queries/assets";
import { getAssetIssues } from "@/lib/queries/asset-issues";
import { getCurrentProfile } from "@/lib/auth";
import { ISSUES, isIssueKey, type IssueKey } from "@/lib/asset-issues";
import { hasPermission } from "@/lib/queries/permissions";
import { AssetDbClient } from "@/components/assets/AssetDbClient";
import type { AssetStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { site?: string; q?: string; status?: string; sort?: string; page?: string; issue?: string };
}

async function noIssues(): Promise<Record<IssueKey, never[]>> {
  return Object.fromEntries(Object.keys(ISSUES).map((k) => [k, []])) as unknown as Record<IssueKey, never[]>;
}

export default async function AssetDatabasePage({ searchParams }: PageProps) {
  if (!(await hasPermission("assets:read"))) redirect("/dashboard");

  const site = searchParams.site ?? "";
  const q = searchParams.q ?? "";
  const status = (searchParams.status ?? "") as AssetStatus | "";
  const sort = searchParams.sort === "health_asc" ? "health_asc" : "";
  const page = Number(searchParams.page ?? "1") || 1;
  // The data-check panel ("ข้อมูลที่ควรตรวจ") is for admins only; others never load it.
  const isAdmin = (await getCurrentProfile())?.role === "admin";
  const issue = isAdmin && isIssueKey(searchParams.issue) ? searchParams.issue : "";

  const [list, issues, reference, siteCounts, canWrite, canDelete, canDeleteAll, canImport] = await Promise.all([
    getAssetsList({ site, q, status, sort, page }),
    isAdmin ? getAssetIssues() : noIssues(),
    getReference(),
    getSiteCounts(),
    hasPermission("assets:write"),
    hasPermission("assets:delete"),
    hasPermission("assets:delete_all"),
    hasPermission("assets:import"),
  ]);

  // An issue chip shows just the machines with that issue (other filters off).
  const issueRows = issue ? issues[issue] : [];
  const issuePages = Math.max(1, Math.ceil(issueRows.length / 20));
  const issuePage = Math.min(page, issuePages);
  const issueCounts = Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])) as Record<IssueKey, number>;

  return (
    <AssetDbClient
      rows={issue ? issueRows.slice((issuePage - 1) * 20, issuePage * 20) : list.rows}
      total={issue ? issueRows.length : list.total}
      page={issue ? issuePage : list.page}
      pages={issue ? issuePages : list.pages}
      issue={issue}
      issueCounts={issueCounts}
      site={site}
      q={q}
      status={status}
      sort={sort}
      sites={reference.sites}
      types={reference.types}
      typeMap={reference.typeMap}
      siteCounts={siteCounts}
      canWrite={canWrite}
      canDelete={canDelete}
      canDeleteAll={canDeleteAll}
      canImport={canImport}
    />
  );
}
