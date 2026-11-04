import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/queries/assets";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { hasPermission } from "@/lib/queries/permissions";
import { ReportsClient } from "@/components/reports/ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  if (!(await hasPermission("reports:view"))) redirect("/dashboard");

  const [{ data, reference }, alarm, canSendEmail] = await Promise.all([
    getDashboardData(""),
    getAlarmConfig(),
    hasPermission("reports:send_email"),
  ]);
  return <ReportsClient data={data} sites={reference.sites} alarm={alarm} canSendEmail={canSendEmail} />;
}
