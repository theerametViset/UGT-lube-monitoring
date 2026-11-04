import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/env";
import { getDemoMaintenance } from "@/lib/demo-data";
import type { MaintenanceRecord } from "@/lib/types";

export async function listMaintenance(assetId: string): Promise<MaintenanceRecord[]> {
  if (isDemoMode()) return getDemoMaintenance(assetId);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("maintenance_records")
    .select("id,asset_id,type,work_date,wo_no,description,parts,cost,technician")
    .eq("asset_id", assetId)
    .order("work_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MaintenanceRecord[];
}
