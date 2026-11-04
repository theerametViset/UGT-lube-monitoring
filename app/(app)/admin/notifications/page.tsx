import { redirect } from "next/navigation";
import { getNotificationConfig } from "@/lib/queries/notifications";
import { hasPermission } from "@/lib/queries/permissions";
import { NotificationConfigClient } from "@/components/admin/NotificationConfigClient";

export const dynamic = "force-dynamic";

export default async function NotificationConfigPage() {
  const canManage = await hasPermission("notifications:manage");
  if (!canManage) redirect("/dashboard");

  const config = await getNotificationConfig();
  return <NotificationConfigClient initialConfig={config} />;
}
