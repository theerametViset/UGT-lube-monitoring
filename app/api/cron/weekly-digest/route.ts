import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/queries/assets";
import { sendEmail } from "@/lib/email/send";
import { weeklyDigestEmail } from "@/lib/email/weekly-digest";
import { getNotificationConfig } from "@/lib/queries/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

// Vercel Cron: GET /api/cron/weekly-digest — scheduled in vercel.json, every
// Monday 06:00 UTC. Cron has no user session, so it reads with the service-role
// client (the whole fleet, like a global admin view).
export async function GET(request: Request) {
  // The cron endpoint can send emails to real recipients — ALWAYS require the
  // Vercel cron secret (previously the guard was skipped when CRON_SECRET was
  // unset, leaving the route open to any authenticated caller).
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = isDemoMode() ? undefined : createAdminClient();
    const cfg = await getNotificationConfig(admin);
    if (!cfg.enable_weekly_summary || !cfg.email_recipients.length) {
      return NextResponse.json({ ok: true, message: "Weekly digest disabled or no recipients" });
    }

    const { data } = await getDashboardData("", admin);

    const { subject, html } = weeklyDigestEmail({
      totalAssets: data.kpis.total,
      critical: data.kpis.critical,
      warning: data.kpis.warning,
      avgHealth: data.kpis.avgHealth,
      topCritical: data.topCritical.slice(0, 5).map((a) => ({ id: a.id, name: a.name, health: a.health })),
    });

    const result = await sendEmail({
      to: cfg.email_recipients,
      from: cfg.from_email,
      subject,
      html,
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "เกิดข้อผิดพลาดภายในระบบ" }, { status: 500 });
  }
}
