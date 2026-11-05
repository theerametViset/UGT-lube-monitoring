import Link from "next/link";
import { notFound } from "next/navigation";
import { getAsset, getAssetOptions, getReference } from "@/lib/queries/assets";
import { getReadingsHistory } from "@/lib/queries/readings";
import { listMaintenance } from "@/lib/queries/maintenance";
import { getAssetAlarmConfig } from "@/lib/queries/alarms";
import { listAttachments } from "@/lib/queries/attachments";
import { getDeductionBreakdown } from "@/lib/scoring/audit";
import { hasPermission } from "@/lib/queries/permissions";

import { getRcaProbabilities } from "@/lib/scoring/rca";
import { listStandardsRelated } from "@/lib/queries/standards";
import { DrillDownClient } from "@/components/drilldown/DrillDownClient";
import { getAssetHistory } from "@/lib/queries/audit-log";
import { isDemoMode } from "@/lib/env";

const OIL_KEYS = ["fe", "water", "visc", "tan"];
const VIB_KEYS = ["vel", "acc", "cf", "temp"];

export const dynamic = "force-dynamic";

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s; // a literal "%" in an ID that isn't an escape
  }
}

export default async function AssetDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Next hands the segment over still percent-encoded when it has spaces or "()" ("15-B01%20(AUTO%20RUN)").
  const id = safeDecode(params.id);
  const asset = await getAsset(id);
  if (!asset) notFound();

  const [{ oil, vib }, maintenance, alarm, reference, attachments, standards, compareOptions, canManageMaint, canManageAttachments, canReadHistory, canDeleteReadings] = await Promise.all([
    getReadingsHistory(id),
    listMaintenance(id),
    getAssetAlarmConfig(id),
    getReference(),
    listAttachments(id),
    listStandardsRelated([...OIL_KEYS, ...VIB_KEYS], asset.type),
    getAssetOptions(),
    hasPermission("maintenance:write"),
    hasPermission("attachments:write"),
    // Demo / Local Store have no logins; in Supabase the audit log is audit:read only.
    isDemoMode() ? Promise.resolve(true) : hasPermission("audit:read"),
    hasPermission("readings:write"),
  ]);
  const history = canReadHistory ? await getAssetHistory(id) : null;

  const relatedStandards = {
    oil: standards.filter((s) => (s.related_params ?? []).some((k) => OIL_KEYS.includes(k))),
    vib: standards.filter((s) => (s.related_params ?? []).some((k) => VIB_KEYS.includes(k))),
  };

  const latestOil = oil.length ? oil[oil.length - 1] : null;
  const latestVib = vib.length ? vib[vib.length - 1] : null;

  const audit = getDeductionBreakdown(latestOil, latestVib, alarm.params, alarm.scoreConfig, asset.vg_grade);
  const rca = getRcaProbabilities(latestOil, latestVib, alarm.params);

  return (
    <DrillDownClient
      asset={asset}
      oilHistory={oil}
      vibHistory={vib}
      maintenance={maintenance}
      audit={audit}
      rca={rca}
      params={alarm.params}
      scoreConfig={alarm.scoreConfig}
      typeColor={reference.typeMap[asset.type]?.color ?? "#94a3b8"}
      typeAbbr={reference.typeMap[asset.type]?.abbr ?? "OT"}
      attachments={attachments}
      relatedStandards={relatedStandards}
      compareOptions={compareOptions.filter((a) => a.id !== asset.id)}
      canManageMaint={canManageMaint}
      canManageAttachments={canManageAttachments}
      canDeleteReadings={canDeleteReadings}
      history={history}
    />
  );
}
