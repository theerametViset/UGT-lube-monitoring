import { redirect } from "next/navigation";
import { listStandards } from "@/lib/queries/standards";
import { isDemoMode } from "@/lib/env";
import { hasPermission } from "@/lib/queries/permissions";
import { StandardsClient } from "@/components/standards/StandardsClient";

export const dynamic = "force-dynamic";

export default async function StandardsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  if (!(await hasPermission("standards:read"))) redirect("/dashboard");

  const q = searchParams.q ?? "";
  const [standards, canManage, canManageAttachments] = await Promise.all([
    listStandards({ q }),
    hasPermission("standards:write"),
    hasPermission("attachments:write"),
  ]);
  return (
    <StandardsClient
      initialStandards={standards}
      initialQ={q}
      demo={isDemoMode()}
      canManage={canManage}
      canManageAttachments={canManageAttachments}
    />
  );
}
