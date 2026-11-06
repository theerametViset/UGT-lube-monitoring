import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/queries/assets";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { hasPermission } from "@/lib/queries/permissions";
import { ReportsClient } from "@/components/reports/ReportsClient";
import { getActionReasons } from "@/lib/queries/action-reasons";
import { reportActionAssets } from "@/lib/exec-summary-text";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  if (!(await hasPermission("reports:view"))) redirect("/dashboard");

  const [{ data, reference }, alarm, canSendEmail, canEdit] = await Promise.all([
    getDashboardData(""),
    getAlarmConfig(),
    hasPermission("reports:send_email"),
    hasPermission("reports:edit"),
  ]);
  const reasons = await getActionReasons(reportActionAssets(data.scopedAssets));
  return <ReportsClient data={data} sites={reference.sites} alarm={alarm} reasons={reasons} canSendEmail={canSendEmail} canEdit={canEdit} />;
}
