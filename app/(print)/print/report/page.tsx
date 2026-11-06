import { getDashboardData } from "@/lib/queries/assets";
import { getAlarmConfig } from "@/lib/queries/alarms";
import { ReportDoc, type ReportConfig } from "@/components/reports/ReportDoc";
import { getActionReasons } from "@/lib/queries/action-reasons";
import { reportActionAssets, scopeReport } from "@/lib/exec-summary-text";

export const dynamic = "force-dynamic";

// (AUD-023) Cap user text carried in the URL.
const MAX_NOTE = 500;

interface PageProps {
  searchParams: {
    site?: string;
    period?: string;
    type?: string;
    prepared?: string;
    reviewed?: string;
    approved?: string;
    note?: string;
  };
}

export default async function PrintReportPage({ searchParams }: PageProps) {
  const config: ReportConfig = {
    type: (searchParams.type as ReportConfig["type"]) || "exec",
    period: searchParams.period || "ytd",
    site: searchParams.site || "",
    prepared: searchParams.prepared || "Reliability Engineer",
    reviewed: searchParams.reviewed || "Maintenance Manager",
    approved: searchParams.approved || "Plant Manager",
    note: (searchParams.note || "").slice(0, MAX_NOTE),
  };

  const [{ data }, alarm] = await Promise.all([
    getDashboardData(""),
    getAlarmConfig(),
  ]);
  // only the plant being printed: one plant needs at most 10 machines' causes, not every plant's
  const reasons = await getActionReasons(reportActionAssets(scopeReport(data, config.site).scopedAssets));

  return (
    <div className="min-h-screen bg-bg py-6 print:min-h-0 print:py-0">
      <ReportDoc
        data={data}
        alarm={alarm}
        config={config}
        reasons={reasons}
        autoPrint
        showToolbar
      />
    </div>
  );
}
