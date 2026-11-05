import { redirect } from "next/navigation";
import { getAssetOptions, getReference } from "@/lib/queries/assets";
import { hasPermission } from "@/lib/queries/permissions";
import { isDemoMode, isLocalStore } from "@/lib/env";
import { DataEntryClient } from "@/components/dataentry/DataEntryClient";

export const dynamic = "force-dynamic";

export default async function DataEntryPage({ searchParams }: { searchParams: { asset?: string } }) {
  if (!(await hasPermission("dataentry:read"))) redirect("/dashboard");

  // Storage uploads require attachments:write (AUD-005 policy) — hide the picker
  // from roles that cannot upload, instead of letting the upload fail silently.
  const [assets, reference, canUpload, canSave] = await Promise.all([
    getAssetOptions(),
    getReference(),
    hasPermission("attachments:write"),
    hasPermission("readings:write"),
  ]);
  return (
    <DataEntryClient
      assets={assets}
      sites={reference.sites}
      demo={isDemoMode()}
      localStore={isLocalStore()}
      canUpload={canUpload}
      canSave={canSave}
      initialAssetId={searchParams.asset}
    />
  );
}
