import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isLocalStore } from "@/lib/env";
import { listLocalAttachments } from "@/lib/local-store";
import type { ReadingAttachment, StandardAttachment } from "@/lib/types";

export async function listAttachments(
  assetId: string,
  period?: string,
): Promise<ReadingAttachment[]> {
  if (isLocalStore()) return listLocalAttachments(assetId, period);
  if (isDemoMode()) return [];
  const supabase = createClient();
  let query = supabase
    .from("reading_attachments")
    .select("*")
    .eq("asset_id", assetId);
  if (period) query = query.eq("period", period);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ReadingAttachment[];
}

export async function listStandardAttachments(standardId: string): Promise<StandardAttachment[]> {
  if (isDemoMode()) return []; // storage is real-mode only
  const supabase = createClient();
  const { data, error } = await supabase
    .from("standard_attachments")
    .select("*")
    .eq("standard_id", standardId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StandardAttachment[];
}
