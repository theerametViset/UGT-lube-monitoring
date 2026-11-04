"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      disabled={busy}
      aria-label="ออกจากระบบ"
      title="ออกจากระบบ"
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[13px] font-semibold text-t2 hover:border-cyan hover:text-cyan disabled:opacity-40"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      <span className="max-[760px]:hidden">{busy ? "…" : "ออกจากระบบ"}</span>
    </button>
  );
}
