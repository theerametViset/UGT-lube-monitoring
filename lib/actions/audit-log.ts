"use server";

import { createClient } from "@/lib/supabase/server";
import { isDemoMode, isLocalStore } from "@/lib/env";
import { appendLocalAudit } from "@/lib/local-store";

// Insert audit log entry — call after any data mutation
export async function logAudit(opts: {
  action: string;
  table_name: string;
  record_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
}): Promise<void> {
  if (isLocalStore()) {
    try {
      appendLocalAudit({ action: opts.action, table_name: opts.table_name, record_id: opts.record_id ?? null, old_value: opts.old_value ?? null, new_value: opts.new_value ?? null });
    } catch {
      // history must never block the save
    }
    return;
  }
  if (isDemoMode()) return; // skip in demo
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      action: opts.action,
      table_name: opts.table_name,
      record_id: opts.record_id ?? null,
      old_value: opts.old_value ?? null,
      new_value: opts.new_value ?? null,
    });
  } catch {
    // audit log failure should never block the main operation
  }
}
