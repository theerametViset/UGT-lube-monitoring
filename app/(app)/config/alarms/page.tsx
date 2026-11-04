import { redirect } from "next/navigation";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { getAssetOptions } from "@/lib/queries/assets";
import { getStandardsByParam } from "@/lib/queries/standards";
import { hasPermission } from "@/lib/queries/permissions";
import { AlarmClient } from "@/components/alarm/AlarmClient";

export const dynamic = "force-dynamic";

const PARAM_KEYS = ["fe", "water", "visc", "tan", "vel", "acc", "cf", "temp"];

export default async function AlarmConfigPage() {
  if (!(await hasPermission("alarms:read"))) redirect("/dashboard");

  const [config, assets, standardsByParam, canManage] = await Promise.all([
    getAlarmConfig(),
    getAssetOptions(),
    getStandardsByParam(PARAM_KEYS),
    hasPermission("alarms:write"),
  ]);
  return (
    <AlarmClient
      initialParams={config.params}
      initialScore={config.scoreConfig}
      assets={assets}
      standardsByParam={standardsByParam}
      canManage={canManage}
    />
  );
}
